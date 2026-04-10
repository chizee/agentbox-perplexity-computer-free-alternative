"use client";

import { useEffect, useState } from "react";
import { MessageSquareIcon, TrashIcon } from "lucide-react";

interface Chat {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export function ChatsView({
  activeChatId,
  onSelectChat,
}: {
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
}) {
  const [chats, setChats] = useState<Chat[]>([]);

  const fetchChats = async () => {
    const res = await fetch("/api/chats");
    const data = await res.json();
    setChats(data.chats || []);
  };

  useEffect(() => { fetchChats(); }, []);

  const deleteChat = async (id: string) => {
    await fetch(`/api/chats/${id}`, { method: "DELETE" });
    setChats((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/50 px-6 py-4">
        <h2 className="text-lg font-medium">Chats</h2>
        <p className="text-sm text-muted-foreground">Your conversation history</p>
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4">
        {chats.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 pt-20 text-muted-foreground">
            <MessageSquareIcon className="size-10 opacity-30" />
            <p className="text-sm">No chats yet</p>
          </div>
        ) : (
          <div className="mx-auto grid max-w-3xl gap-2">
            {chats.map((chat) => (
              <div
                key={chat.id}
                onClick={() => onSelectChat(chat.id)}
                className={`group flex w-full min-w-0 cursor-pointer items-center justify-between gap-3 rounded-lg border border-border/50 px-4 py-3 transition-colors hover:bg-muted/50 ${
                  chat.id === activeChatId ? "border-foreground/20 bg-muted/30" : ""
                }`}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <MessageSquareIcon className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{chat.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(chat.created_at).toLocaleString(undefined, {
                        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); deleteChat(chat.id); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); deleteChat(chat.id); } }}
                  className="shrink-0 rounded p-1 text-muted-foreground/50 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                >
                  <TrashIcon className="size-3.5" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
