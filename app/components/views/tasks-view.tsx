"use client";

import { useEffect, useState } from "react";
import {
  ListTodoIcon,
  ClockIcon,
  LoaderIcon,
  CheckCircle2Icon,
  XCircleIcon,
  CircleDotIcon,
  TrashIcon,
} from "lucide-react";

interface Task {
  id: string;
  title: string;
  status: "pending" | "running" | "completed" | "failed" | "scheduled";
  sandbox_id: string | null;
  created_at: string;
  updated_at: string;
  scheduled_at: string | null;
}

const statusConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  pending: { icon: <ClockIcon className="size-4" />, color: "text-muted-foreground", label: "Pending" },
  running: { icon: <LoaderIcon className="size-4 animate-spin" />, color: "text-blue-400", label: "Running" },
  completed: { icon: <CheckCircle2Icon className="size-4" />, color: "text-green-400", label: "Completed" },
  failed: { icon: <XCircleIcon className="size-4" />, color: "text-red-400", label: "Failed" },
  scheduled: { icon: <CircleDotIcon className="size-4" />, color: "text-yellow-400", label: "Scheduled" },
};

export function TasksView() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<string>("all");

  const fetchTasks = async () => {
    const res = await fetch("/api/tasks");
    const data = await res.json();
    setTasks(data.tasks || []);
  };

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 5000);
    return () => clearInterval(interval);
  }, []);

  const deleteTask = async (id: string) => {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const filtered = filter === "all" ? tasks : tasks.filter((t) => t.status === filter);
  const filters = ["all", "running", "pending", "scheduled", "completed", "failed"];

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/50 px-6 py-4">
        <h2 className="text-lg font-medium">Tasks</h2>
        <p className="text-sm text-muted-foreground">All past and scheduled tasks</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-border/50 px-4 py-2">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors ${
              filter === f
                ? "bg-foreground/10 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 pt-20 text-muted-foreground">
            <ListTodoIcon className="size-10 opacity-30" />
            <p className="text-sm">No {filter === "all" ? "" : filter} tasks</p>
          </div>
        ) : (
          <div className="grid gap-2">
            {filtered.map((task) => {
              const cfg = statusConfig[task.status] || statusConfig.pending;
              return (
                <div
                  key={task.id}
                  className="group flex items-center justify-between rounded-lg border border-border/50 px-4 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cfg.color}>{cfg.icon}</div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{task.title}</p>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        <span>{cfg.label}</span>
                        <span>·</span>
                        <span>{new Date(task.created_at).toLocaleDateString()}</span>
                        {task.sandbox_id && (
                          <>
                            <span>·</span>
                            <span className="font-mono">{task.sandbox_id}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => deleteTask(task.id)}
                    onKeyDown={(e) => { if (e.key === "Enter") deleteTask(task.id); }}
                    className="shrink-0 rounded p-1 text-muted-foreground/50 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  >
                    <TrashIcon className="size-3.5" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
