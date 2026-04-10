"use client";

import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { ChatsView } from "@/components/views/chats-view";

export default function ChatsPage() {
  const router = useRouter();

  return (
    <div className="flex h-full">
      <AppSidebar />
      <main className="flex flex-1 flex-col min-w-0">
        <ChatsView
          activeChatId={null}
          onSelectChat={(id) => router.push(`/chat/${id}`)}
        />
      </main>
    </div>
  );
}
