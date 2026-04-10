"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { ChatView } from "@/components/chat-view";

export default function ChatPage() {
  const params = useParams();
  const chatId = params.id as string;
  const [initialMessages, setInitialMessages] = useState<any[] | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/chats/${chatId}`);
        if (res.ok) {
          const chat = await res.json();
          const parsed = typeof chat.messages === "string" ? JSON.parse(chat.messages) : chat.messages;
          setInitialMessages(parsed || []);
        } else {
          setInitialMessages([]);
        }
      } catch {
        setInitialMessages([]);
      }
      setLoaded(true);
    })();
  }, [chatId]);

  if (!loaded) return null;

  return (
    <div className="flex h-full">
      <AppSidebar />
      <ChatView key={chatId} chatId={chatId} initialMessages={initialMessages || undefined} />
    </div>
  );
}
