"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { FilesView } from "@/components/views/files-view";

export default function FilesPage() {
  return (
    <div className="flex h-full">
      <AppSidebar />
      <main className="flex flex-1 flex-col min-w-0">
        <FilesView />
      </main>
    </div>
  );
}
