"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { DeploymentsView } from "@/components/views/deployments-view";

export default function DeploymentsPage() {
  return (
    <div className="flex h-full">
      <AppSidebar />
      <main className="flex flex-1 flex-col min-w-0">
        <DeploymentsView />
      </main>
    </div>
  );
}
