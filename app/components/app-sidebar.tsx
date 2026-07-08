"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  PlusIcon,
  MessageSquareIcon,
  FolderIcon,
  ListTodoIcon,
  RocketIcon,
  SunIcon,
  MoonIcon,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTheme } from "@/lib/theme";

function SidebarButton({
  icon: Icon,
  label,
  isActive,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger>
        <div
          role="button"
          tabIndex={0}
          onClick={onClick}
          onKeyDown={(e) => { if (e.key === "Enter") onClick(); }}
          className={`flex size-10 cursor-pointer items-center justify-center rounded-lg transition-colors ${
            isActive
              ? "bg-foreground/10 text-foreground"
              : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
          }`}
        >
          <Icon className="size-5" />
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>{label}</TooltipContent>
    </Tooltip>
  );
}

export function AppSidebar() {
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/" || pathname.startsWith("/chat/");
    return pathname.startsWith(path);
  };

  return (
    <div className="flex h-full w-14 shrink-0 flex-col items-center border-r border-border/50 bg-sidebar py-3 gap-1">
      {/* New Chat */}
      <Tooltip>
        <TooltipTrigger>
          <div
            role="button"
            tabIndex={0}
            onClick={() => router.push("/")}
            onKeyDown={(e) => { if (e.key === "Enter") router.push("/"); }}
            className="flex size-10 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
          >
            <PlusIcon className="size-5" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>New Chat</TooltipContent>
      </Tooltip>

      <div className="my-2 h-px w-6 bg-border/50" />

      <SidebarButton
        icon={MessageSquareIcon}
        label="Chats"
        isActive={isActive("/chats")}
        onClick={() => router.push("/chats")}
      />
      <SidebarButton
        icon={FolderIcon}
        label="Files"
        isActive={isActive("/files")}
        onClick={() => router.push("/files")}
      />
      <SidebarButton
        icon={ListTodoIcon}
        label="Tasks"
        isActive={isActive("/tasks")}
        onClick={() => router.push("/tasks")}
      />
      <SidebarButton
        icon={RocketIcon}
        label="Deployments"
        isActive={isActive("/deployments")}
        onClick={() => router.push("/deployments")}
      />

      <div className="my-2 h-px w-6 bg-border/50" />

      {/* Theme Toggle */}
      <ThemeToggle />
    </div>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <Tooltip>
      <TooltipTrigger>
        <div
          role="button"
          tabIndex={0}
          onClick={toggleTheme}
          onKeyDown={(e) => { if (e.key === "Enter") toggleTheme(); }}
          className="flex size-10 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
        >
          {theme === "dark" ? (
            <SunIcon className="size-5" />
          ) : (
            <MoonIcon className="size-5" />
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      </TooltipContent>
    </Tooltip>
  );
}
