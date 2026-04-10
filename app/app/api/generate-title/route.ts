import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";

const openrouter = createOpenAICompatible({
  name: "openrouter",
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

export async function POST(req: Request) {
  const { messages } = await req.json();

  const userMessage = messages?.find((m: { role: string }) => m.role === "user");
  if (!userMessage) return Response.json({ title: "New Chat" });

  const text =
    typeof userMessage.content === "string"
      ? userMessage.content
      : userMessage.parts?.filter((p: { type: string }) => p.type === "text").map((p: { text: string }) => p.text).join("") || "";

  if (!text.trim()) return Response.json({ title: "New Chat" });

  try {
    const { text: rawTitle } = await generateText({
      model: openrouter.chatModel("google/gemini-2.0-flash-001"),
      maxOutputTokens: 30,
      system:
        "You generate chat titles. Output ONLY a 3-5 word title summarizing the user's message. No quotes, no punctuation, no prefixes like 'Title:'. Just the title text itself.",
      prompt: `User message: ${text.slice(0, 300)}\n\nTitle:`,
    });

    // Clean up: remove quotes, take first line only, trim
    let title = rawTitle
      .split("\n")[0]
      .replace(/^["'`]+|["'`]+$/g, "")
      .replace(/^Title:\s*/i, "")
      .trim();

    // Cap length
    if (title.length > 60) title = title.slice(0, 57) + "...";

    return Response.json({ title: title || "New Chat" });
  } catch {
    return Response.json({ title: text.slice(0, 40) || "New Chat" });
  }
}
