"use client";

import { useState, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRouter } from "next/navigation";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import {
  AlertCircleIcon, CheckIcon, CopyIcon, MessageSquareIcon, MonitorIcon,
  TerminalIcon, LoaderIcon, FileIcon, FolderIcon, GlobeIcon, CameraIcon,
  PencilIcon, MousePointerIcon, EyeIcon, XIcon,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from "@/components/ai-elements/reasoning";
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
} from "@/components/ai-elements/tool";

const ORCHESTRATOR_TOOLS = ["shell_agent", "browser_agent"];

const AGENT_TOOL_ICONS: Record<string, React.ReactNode> = {
  exec: <TerminalIcon className="size-3" />,
  write_file: <FileIcon className="size-3" />,
  read_file: <FileIcon className="size-3" />,
  edit_file: <PencilIcon className="size-3" />,
  list_dir: <FolderIcon className="size-3" />,
  navigate: <GlobeIcon className="size-3" />,
  screenshot: <CameraIcon className="size-3" />,
  snapshot: <GlobeIcon className="size-3" />,
  click: <MousePointerIcon className="size-3" />,
  type_text: <PencilIcon className="size-3" />,
  scroll: <MonitorIcon className="size-3" />,
  read_page_text: <FileIcon className="size-3" />,
};

function getMessageText(message: any) {
  if (typeof message.content === "string") return message.content;
  return message.parts?.filter((p: any) => p.type === "text").map((p: any) => p.text).join("") || "";
}

function VncPanel({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div className="flex h-full w-[500px] shrink-0 flex-col border-l border-border/50 bg-background">
      <div className="flex h-10 items-center justify-between border-b border-border/50 px-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <EyeIcon className="size-3.5" />
          <span>Live View</span>
        </div>
        <div
          role="button"
          tabIndex={0}
          onClick={onClose}
          onKeyDown={(e) => { if (e.key === "Enter") onClose(); }}
          className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <XIcon className="size-3.5" />
        </div>
      </div>
      <iframe src={url} className="flex-1 border-0" title="Live browser view" />
    </div>
  );
}

function AgentReportFooter({ report }: { report: string }) {
  const [expanded, setExpanded] = useState(false);
  const sliced = report.length > 120 ? report.slice(0, 120) + "..." : report;

  return (
    <div className="border-t border-border/30">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => { if (e.key === "Enter") setExpanded(!expanded); }}
        className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/20"
      >
        <CheckIcon className="size-3 shrink-0 text-green-400" />
        <span className="font-medium shrink-0">Report</span>
        {!expanded && <span className="truncate opacity-60">{sliced}</span>}
      </div>
      {expanded && (
        <div className="px-3 pb-3 text-xs text-muted-foreground">
          <MessageResponse>{report}</MessageResponse>
        </div>
      )}
    </div>
  );
}

function AgentActivityItem({ data }: { data: any }) {
  return (
    <div className="flex items-center gap-2 py-0.5 text-xs text-muted-foreground">
      {AGENT_TOOL_ICONS[data.toolName] || <TerminalIcon className="size-3" />}
      <span className="font-mono">{data.toolName}</span>
      {data.args && <span className="truncate max-w-xs opacity-70">{data.args}</span>}
      {data.result && <span className="ml-auto text-[10px] opacity-50 truncate max-w-xs">{data.result}</span>}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.click(); }}
    >
      {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
    </div>
  );
}

function MessageWithParts({ message, isStreaming, onOpenVnc, chatCompleted }: { message: any; isStreaming?: boolean; onOpenVnc?: (url: string) => void; chatCompleted?: boolean }) {
  const parts = message.parts || [];

  const isToolPart = (p: any) => p.type === "tool-invocation" || p.type?.startsWith("tool-");
  const getToolName = (p: any) => p.toolName || p.type?.replace("tool-", "") || "";

  const hasContent = parts.some((p: any) =>
    p.type === "text" || p.type === "reasoning" || p.type === "tool-invocation" || p.type?.startsWith("tool-") || p.type === "data-agent-activity"
  );
  if (!hasContent && message.role === "assistant") return null;

  const text = parts.filter((p: any) => p.type === "text").map((p: any) => p.text).join("") || "";

  const hasTextOrToolAfterReasoning = (idx: number) =>
    parts.slice(idx + 1).some((p: any) => p.type === "text" || isToolPart(p));

  // Group parts into segments
  const segments: Array<{ type: "regular"; parts: any[] } | { type: "agent"; toolPart: any; activities: any[]; vncLink: any | null }> = [];
  let currentAgent: { toolPart: any; activities: any[]; vncLink: any | null } | null = null;
  let currentRegular: any[] = [];

  for (const part of parts) {
    const toolName = getToolName(part);
    const isOrchestratorTool = isToolPart(part) && ORCHESTRATOR_TOOLS.includes(toolName);
    if (isToolPart(part)) console.log("[tool part]", part.type, toolName, "isOrch:", isOrchestratorTool, "state:", part.state);
    const isVncLink = part.type === "data-vnc-link" || (part.type === "data" && part.data?.url && part.data?.sandboxId);
    const isAgentActivity = part.type === "data-agent-activity" || (part.type === "data" && part.data?.toolName);

    if (isOrchestratorTool) {
      if (currentRegular.length) { segments.push({ type: "regular", parts: currentRegular }); currentRegular = []; }
      if (currentAgent) { segments.push({ type: "agent", ...currentAgent }); }
      currentAgent = { toolPart: part, activities: [], vncLink: null };
    } else if (isVncLink || isAgentActivity) {
      // Create a synthetic agent block if we see activity without a tool part (e.g. from DB during streaming)
      if (!currentAgent) {
        if (currentRegular.length) { segments.push({ type: "regular", parts: currentRegular }); currentRegular = []; }
        const activityData = part.data || part;
        const syntheticToolName = activityData?.agentType === "shell" ? "shell_agent" : "browser_agent";
        currentAgent = {
          toolPart: { type: `tool-${syntheticToolName}`, toolName: syntheticToolName, state: "input-available", args: {} },
          activities: [],
          vncLink: null,
        };
      }
      if (isVncLink) currentAgent.vncLink = part.data || part;
      else currentAgent.activities.push(part.data || part);
    } else {
      if (currentAgent) { segments.push({ type: "agent", ...currentAgent }); currentAgent = null; }
      currentRegular.push(part);
    }
  }
  if (currentAgent) segments.push({ type: "agent", ...currentAgent });
  if (currentRegular.length) segments.push({ type: "regular", parts: currentRegular });

  return (
    <Message from={message.role}>
      <MessageContent>
        {segments.map((seg, si) => {
          if (seg.type === "agent") {
            const { toolPart, activities, vncLink } = seg;
            const toolName = getToolName(toolPart);
            const agentType = toolName === "shell_agent" ? "Shell" : "Browser";
            const toolStillRunning = toolPart.state !== "result" && toolPart.state !== "output-available";
            const isRunning = toolStillRunning && !chatCompleted;
            const task = toolPart.args?.task || toolPart.input?.task || "";

            // Get activities from stream data parts OR from tool result
            const toolResult = toolPart.result || toolPart.output;
            const resultActivities = toolResult?.activities || [];
            const allActivities = activities.length > 0 ? activities : resultActivities;

            // Get VNC info from tool result if not from stream
            const resultVncPort = toolResult?.vncPort;
            const effectiveVncLink = vncLink || (resultVncPort ? { url: `http://localhost:${resultVncPort}/vnc.html?autoconnect=true&resize=scale` } : null);

            return (
              <div key={toolPart.toolCallId || si} className="my-3 rounded-lg border border-border/50 bg-muted/10 overflow-hidden">
                <div className="flex items-center gap-2 border-b border-border/30 bg-muted/20 px-3 py-2">
                  <div className="flex size-5 items-center justify-center rounded bg-foreground/10">
                    {toolName === "shell_agent"
                      ? <TerminalIcon className="size-3 text-green-400" />
                      : <MonitorIcon className="size-3 text-blue-400" />}
                  </div>
                  <span className="text-xs font-medium">{agentType} Agent</span>
                  {isRunning && <LoaderIcon className="size-3 animate-spin text-muted-foreground" />}
                  {!isRunning && <CheckIcon className="size-3 text-green-400" />}
                  {effectiveVncLink && onOpenVnc && isRunning && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => onOpenVnc(effectiveVncLink.url)}
                      onKeyDown={(e) => { if (e.key === "Enter") onOpenVnc!(effectiveVncLink.url); }}
                      className="ml-auto flex cursor-pointer items-center gap-1 rounded px-2 py-0.5 text-[10px] text-blue-400 transition-colors hover:bg-blue-500/10"
                    >
                      <EyeIcon className="size-3" />
                      Watch
                    </div>
                  )}
                </div>
                {task && (
                  <div className="px-3 py-2 text-xs text-muted-foreground border-b border-border/20">{task}</div>
                )}
                {allActivities.length > 0 && (
                  <div className="px-3 py-2 space-y-0.5">
                    {allActivities.map((a: any, ai: number) => <AgentActivityItem key={ai} data={a} />)}
                  </div>
                )}
                {!isRunning && (() => {
                  const reportText = toolPart.result?.result || toolPart.output?.result || "";
                  if (!reportText || reportText === "Task completed.") return null;
                  return <AgentReportFooter report={reportText} />;
                })()}
              </div>
            );
          }

          return seg.parts.map((part: any, pi: number) => {
            const i = `${si}-${pi}`;
            if (part.type === "reasoning") {
              const reasoningText = part.reasoning || part.text || part.content || "";
              const partIdx = parts.indexOf(part);
              const stillStreaming = isStreaming && !hasTextOrToolAfterReasoning(partIdx);
              return (
                <Reasoning key={i} isStreaming={stillStreaming} defaultOpen={stillStreaming}>
                  <ReasoningTrigger />
                  <ReasoningContent className="text-muted-foreground">{reasoningText}</ReasoningContent>
                </Reasoning>
              );
            }
            if (isToolPart(part)) {
              return (
                <Tool key={i}>
                  <ToolHeader tool={part} />
                  <ToolContent><ToolInput input={part.args} /></ToolContent>
                </Tool>
              );
            }
            if (part.type === "text" && part.text) {
              return <MessageResponse key={i}>{part.text}</MessageResponse>;
            }
            return null;
          });
        })}
      </MessageContent>
      {message.role === "assistant" && text && (
        <div className="mt-1 flex gap-1"><CopyButton text={text} /></div>
      )}
    </Message>
  );
}

type Mode = "chat" | "computer";

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  return (
    <div className="inline-flex items-center rounded-full border border-border/50 bg-muted/30 p-0.5">
      <Tooltip>
        <TooltipTrigger>
          <div role="button" tabIndex={0} onClick={() => onChange("chat")}
            onKeyDown={(e) => { if (e.key === "Enter") onChange("chat"); }}
            className={`inline-flex items-center justify-center rounded-full size-7 cursor-pointer transition-all ${mode === "chat" ? "bg-foreground/10 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            <MessageSquareIcon className="size-3.5" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={8}>Chat</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger>
          <div role="button" tabIndex={0} onClick={() => onChange("computer")}
            onKeyDown={(e) => { if (e.key === "Enter") onChange("computer"); }}
            className={`inline-flex items-center justify-center rounded-full size-7 cursor-pointer transition-all ${mode === "computer" ? "bg-foreground/10 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            <MonitorIcon className="size-3.5" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={8}>Computer</TooltipContent>
      </Tooltip>
    </div>
  );
}

function ChatInput({ onSubmit, onStop, isLoading, mode, onModeChange, className }: {
  onSubmit: (text: string) => void; onStop?: () => void; isLoading: boolean; mode: Mode; onModeChange: (mode: Mode) => void; className?: string;
}) {
  return (
    <div className={className}>
      <PromptInput onSubmit={(msg) => {
        if (isLoading) return;
        if (msg.text?.trim()) onSubmit(msg.text);
      }}>
        <PromptInputBody>
          <PromptInputTextarea placeholder={isLoading ? "Working..." : "Ask anything..."} className="min-h-14 text-base" disabled={isLoading} />
        </PromptInputBody>
        <PromptInputFooter className="justify-between">
          <ModeToggle mode={mode} onChange={onModeChange} />
          <PromptInputSubmit
            status={isLoading ? "streaming" : "ready"}
            onClick={isLoading ? (e) => { e.preventDefault(); onStop?.(); } : undefined}
          />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}

export function ChatView({ chatId, initialMessages }: { chatId: string; initialMessages?: any[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("chat");
  const [vncUrl, setVncUrl] = useState<string | null>(null);
  const [chatStatus, setChatStatus] = useState<string>("idle");
  // Start as true if we're loading an existing chat with messages (title already exists)
  const [titleGenerated, setTitleGenerated] = useState(
    !!(initialMessages && initialMessages.length >= 2)
  );

  // Check initial status
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/chats/${chatId}`);
        const chat = await res.json();
        setChatStatus(chat.status || "idle");
      } catch {}
    })();
  }, [chatId]);

  const { messages, sendMessage, setMessages, status, error, clearError, stop } = useChat({
    id: chatId,
    ...(initialMessages && initialMessages.length > 0 ? { messages: initialMessages } : {}),
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest({ messages, id }) {
        return { body: { message: messages[messages.length - 1], id } };
      },
    }),
  });

  const isLoading = status === "streaming" || status === "submitted";

  // Poll for updates if chat is streaming in background (reconnect scenario)
  useEffect(() => {
    console.log("[poll check]", { chatStatus, isLoading });
    if (chatStatus !== "streaming" || isLoading) return;
    console.log("[polling] started");
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/chats/${chatId}`);
        const chat = await res.json();
        const parsed = typeof chat.messages === "string" ? JSON.parse(chat.messages) : chat.messages;
        if (parsed?.length) setMessages(parsed);
        if (chat.status === "completed" || chat.status === "idle") {
          setChatStatus(chat.status);
        }
      } catch {}
    }, 2000);
    return () => clearInterval(interval);
  }, [chatStatus, chatId, isLoading]);
  const hasMessages = messages.length > 0;

  // Update URL when first message is sent (no navigation, just rewrite)
  useEffect(() => {
    if (messages.length >= 1 && window.location.pathname === "/") {
      window.history.replaceState(null, "", `/chat/${chatId}`);
    }
  }, [messages, chatId]);

  // Generate title after first response
  useEffect(() => {
    if (messages.length >= 2 && !titleGenerated) {
      setTitleGenerated(true);
      (async () => {
        try {
          const titleRes = await fetch("/api/generate-title", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages }),
          });
          const { title } = await titleRes.json();
          if (title) {
            fetch(`/api/chats/${chatId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ title }),
            });
          }
        } catch {}
      })();
    }
  }, [messages, titleGenerated, chatId]);

  const errorBanner = error ? (
    <div className="mx-auto flex w-full max-w-2xl items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      <AlertCircleIcon className="size-4 shrink-0" />
      <span className="flex-1">{error.message}</span>
      <button onClick={clearError} className="text-destructive/70 hover:text-destructive">✕</button>
    </div>
  ) : null;

  return (
    <>
      <main className="flex flex-1 flex-col min-w-0">
        {!hasMessages ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4">
            <h1 className="text-4xl font-light tracking-tight text-foreground/80">
              <span className="text-foreground/50">agent</span>
              <span className="font-medium text-foreground">box</span>
            </h1>
            {errorBanner}
            <ChatInput
              className="w-full max-w-2xl"
              isLoading={isLoading}
              onSubmit={(text) => sendMessage({ text })}
              onStop={stop}
              mode={mode}
              onModeChange={setMode}
            />
          </div>
        ) : (
          <>
            {chatStatus === "streaming" && !isLoading && (
              <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-2 text-xs text-muted-foreground">
                <LoaderIcon className="size-3 animate-spin" />
                <span>Task still running in background...</span>
              </div>
            )}
            <Conversation className="flex-1">
              <ConversationContent className="mx-auto max-w-3xl pt-4">
                {messages.map((message) => (
                  <MessageWithParts
                    key={message.id}
                    message={message}
                    isStreaming={isLoading && message.id === messages[messages.length - 1]?.id}
                    onOpenVnc={setVncUrl}
                    chatCompleted={chatStatus === "completed" && !isLoading}
                  />
                ))}
              </ConversationContent>
              <ConversationScrollButton />
            </Conversation>
            <div className="bg-background px-4 pb-6 pt-2">
              {errorBanner && <div className="mx-auto mb-3 max-w-3xl">{errorBanner}</div>}
              <ChatInput
                className="mx-auto max-w-3xl"
                isLoading={isLoading}
                onSubmit={(text) => sendMessage({ text })}
                onStop={stop}
                mode={mode}
                onModeChange={setMode}
              />
            </div>
          </>
        )}
      </main>
      {vncUrl && <VncPanel url={vncUrl} onClose={() => setVncUrl(null)} />}
    </>
  );
}
