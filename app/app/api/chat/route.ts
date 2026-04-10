import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  streamText,
  UIMessage,
  convertToModelMessages,
  tool,
  stepCountIs,
  createUIMessageStream,
  createUIMessageStreamResponse,
} from "ai";
import { z } from "zod";
import { spawnShellAgentStreaming, spawnBrowserAgentStreaming } from "@/lib/sandbox";
import { loadChat, saveChat, updateChatStatus } from "@/lib/db";

const openrouter = createOpenAICompatible({
  name: "openrouter",
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

const ORCHESTRATOR_TOOLS = ["shell_agent", "browser_agent", "deploy_app"];

const SYSTEM = `You are AgentBox, an AI assistant with access to sandboxed compute and browser environments.

When the user asks you to do something that requires running code, creating files, installing packages, or any compute task — use the shell_agent tool. Pass a clear, detailed description of the task.

When the user asks you to browse a website, preview a web app, interact with a web page, or anything requiring a browser — use the browser_agent tool. Pass a clear description of what to do.

For pure conversation (greetings, explanations, questions), just respond directly without using any tools.

The agents share a persistent workspace (/workspace). Files created by one agent are visible to the next. You can chain agents — e.g., use shell_agent to build an app, then browser_agent to preview it.

Always report what the agent did back to the user in a clear, concise way.`;

function cleanMessagesForLLM(messages: UIMessage[]): UIMessage[] {
  return messages.map((msg) => ({
    ...msg,
    parts: msg.parts?.filter((part) => {
      if (part.type === "text") return true;
      if (part.type === "reasoning") return false;
      const toolName = (part as any).toolName || part.type?.replace("tool-", "") || "";
      const isTool = part.type === "tool-invocation" || part.type?.startsWith("tool-");
      if (isTool && ORCHESTRATOR_TOOLS.includes(toolName)) return true;
      return false;
    }),
  }));
}

export async function POST(req: Request) {
  const { message, id: chatId }: { message?: UIMessage; id: string } =
    await req.json();

  const previousMessages = loadChat(chatId);
  const messages = message ? [...previousMessages, message] : previousMessages;

  const cleanedMessages = cleanMessagesForLLM(messages);
  const modelMessages = await convertToModelMessages(cleanedMessages);

  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  const lastUserText =
    lastUserMessage?.parts
      ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("") || "";

  saveChat(chatId, messages);
  updateChatStatus(chatId, "streaming");

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const result = streamText({
        model: openrouter.chatModel("minimax/minimax-m2.7"),
        stopWhen: stepCountIs(5),
        system: SYSTEM,
        messages: modelMessages,
        tools: {
          shell_agent: tool({
            description: `
Spawn a compute agent to run shell commands, 
create/edit files, install packages, 
run scripts, or do any compute task in a sandboxed Linux environment. 
You MUST provide the 'task' parameter.
`,
            inputSchema: z.object({
              task: z.string().describe("REQUIRED. Detailed description of what the agent should do."),
            }),
            execute: async ({ task }: { task: string }) => {
              const actualTask = task || lastUserText;
              if (!actualTask) return { result: "No task provided" };
              const resultJson = await spawnShellAgentStreaming(chatId, actualTask, writer);
              try {
                const parsed = JSON.parse(resultJson);
                return { result: parsed.result, activities: parsed.activities };
              } catch {
                return { result: resultJson };
              }
            },
          }),
          browser_agent: tool({
            description:
              "Spawn a browser agent to browse websites, preview web apps, take screenshots, interact with web pages, or do any task requiring a browser. You MUST provide the 'task' parameter.",
            inputSchema: z.object({
              task: z.string().describe("REQUIRED. Detailed description of what the agent should do."),
            }),
            execute: async ({ task }: { task: string }) => {
              const actualTask = task || lastUserText;
              if (!actualTask) return { result: "No task provided" };
              const resultJson = await spawnBrowserAgentStreaming(chatId, actualTask, writer);
              try {
                const parsed = JSON.parse(resultJson);
                return { result: parsed.result, activities: parsed.activities, vncPort: parsed.vncPort };
              } catch {
                return { result: resultJson };
              }
            },
          }),
          deploy_app: tool({
            description: `Deploy an app from the chat's workspace as a Docker container.
Use this when the user wants to run/host an app that was built in previous steps by an agent.
The workspace is at /workspace — specify the subdirectory where the app lives (workdir).
For 'static' type: command is ignored, serves files via http.server on the first port.
For 'node' type: runs 'npm install' then your command (e.g. 'npm start', 'node server.js').
For 'python' type: runs 'pip install -r requirements.txt' then your command.
Returns a URL the user can open.`,
            inputSchema: z.object({
              name: z.string().describe("Name for the deployment"),
              type: z.enum(["static", "node", "python"]).describe("App runtime type"),
              workdir: z.string().optional().describe("Subdirectory inside /workspace where the app lives, e.g. 'my-site'. Empty for root."),
              command: z.string().optional().describe("Start command (required for node/python). e.g. 'npm start', 'python app.py'"),
              ports: z.array(z.number()).describe("Ports to expose. First port is the primary URL."),
            }),
            execute: async (args: { name: string; type: string; workdir?: string; command?: string; ports: number[] }) => {
              try {
                const origin = new URL(req.url).origin;
                const res = await fetch(`${origin}/api/deployments`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ chatId, ...args }),
                });
                const data = await res.json();
                if (data.error) return { result: `Deploy failed: ${data.error}` };
                const firstPort = Object.values(data.publishedPorts || {})[0];
                return {
                  result: firstPort
                    ? `Deployed "${args.name}" at http://localhost:${firstPort}`
                    : `Deployed "${args.name}" (no port published)`,
                  deployment: data,
                };
              } catch (e: any) {
                return { result: `Deploy error: ${e.message}` };
              }
            },
          }),
        },
      });

      // Consume — runs to completion even if client disconnects
      result.consumeStream();

      writer.merge(result.toUIMessageStream({ sendStart: false }));
    },
    originalMessages: messages,
    onStepFinish: ({ messages: stepMessages }) => {
      saveChat(chatId, stepMessages);
    },
    onFinish: ({ messages: finalMessages }) => {
      saveChat(chatId, finalMessages);
      updateChatStatus(chatId, "completed");
    },
  });

  // Also consume the outer stream so onStepFinish/onFinish fire even without client
  const [clientStream, serverStream] = stream.tee();
  (async () => {
    const reader = serverStream.getReader();
    try {
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
    } catch {}
  })();

  return createUIMessageStreamResponse({ stream: clientStream });
}
