"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { TasksView } from "@/components/views/tasks-view";

export default function TasksPage() {
  return (
    <div className="flex h-full">
      <AppSidebar />
      <main className="flex flex-1 flex-col min-w-0">
        <TasksView />
      </main>
    </div>
  );
}
