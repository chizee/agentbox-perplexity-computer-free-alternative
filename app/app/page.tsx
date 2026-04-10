"use client";

import { useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { ChatView } from "@/components/chat-view";

function generateId() {
  return Math.random().toString(36).slice(2, 14);
}

export default function HomePage() {
  // Generate a chat ID upfront so persistence works from the first message
  const [chatId] = useState(() => generateId());

  return (
    <div className="flex h-full">
      <AppSidebar />
      <ChatView chatId={chatId} />
    </div>
  );
}
