"use client";

import { useEffect, useState } from "react";
import {
  RocketIcon,
  ExternalLinkIcon,
  TrashIcon,
  CircleIcon,
  CheckCircle2Icon,
  XCircleIcon,
  LoaderIcon,
} from "lucide-react";

interface Deployment {
  id: string;
  chat_id: string;
  chat_title?: string;
  name: string;
  type: "static" | "node" | "python";
  workdir: string;
  command: string;
  ports: string;
  published_ports: string;
  container_id: string;
  status: string;
  created_at: string;
}

const TYPE_COLORS: Record<string, string> = {
  static: "text-cyan-400 border-cyan-400/30 bg-cyan-400/10",
  node: "text-green-400 border-green-400/30 bg-green-400/10",
  python: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10",
};

function StatusIcon({ status }: { status: string }) {
  if (status === "running")
    return <CheckCircle2Icon className="size-3.5 text-green-400" />;
  if (status === "stopped" || status === "exited")
    return <XCircleIcon className="size-3.5 text-muted-foreground" />;
  if (status === "starting")
    return <LoaderIcon className="size-3.5 animate-spin text-blue-400" />;
  return <CircleIcon className="size-3.5 text-muted-foreground" />;
}

export function DeploymentsView() {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDeployments = async () => {
    try {
      const res = await fetch("/api/deployments");
      const data = await res.json();
      setDeployments(data.deployments || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchDeployments();
    const interval = setInterval(fetchDeployments, 5000);
    return () => clearInterval(interval);
  }, []);

  const stopDeployment = async (id: string) => {
    await fetch(`/api/deployments/${id}`, { method: "DELETE" });
    setDeployments((prev) => prev.filter((d) => d.id !== id));
  };

  const getPrimaryUrl = (d: Deployment): string | null => {
    try {
      const published = JSON.parse(d.published_ports || "{}");
      const firstPort = Object.values(published)[0] as number;
      return firstPort ? `http://localhost:${firstPort}` : null;
    } catch {
      return null;
    }
  };

  const getPorts = (d: Deployment): Record<string, number> => {
    try {
      return JSON.parse(d.published_ports || "{}");
    } catch {
      return {};
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/50 px-6 py-4">
        <h2 className="text-lg font-medium">Deployments</h2>
        <p className="text-sm text-muted-foreground">Running apps deployed from chats</p>
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4">
        {loading ? null : deployments.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 pt-20 text-muted-foreground">
            <RocketIcon className="size-10 opacity-30" />
            <p className="text-sm">No deployments yet</p>
            <p className="text-xs">Ask an agent to deploy an app from your chat workspace</p>
          </div>
        ) : (
          <div className="mx-auto grid max-w-3xl gap-2">
            {deployments.map((d) => {
              const primaryUrl = getPrimaryUrl(d);
              const ports = getPorts(d);
              return (
                <div
                  key={d.id}
                  className="group flex w-full min-w-0 flex-col gap-2 rounded-lg border border-border/50 px-4 py-3 transition-colors hover:bg-muted/30"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <RocketIcon className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">{d.name}</p>
                        <span
                          className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium ${TYPE_COLORS[d.type] || ""}`}
                        >
                          {d.type}
                        </span>
                        <div className="flex shrink-0 items-center gap-1">
                          <StatusIcon status={d.status} />
                          <span className="text-[10px] text-muted-foreground capitalize">{d.status}</span>
                        </div>
                      </div>
                      {d.chat_title && (
                        <p className="truncate text-xs text-muted-foreground">
                          from: {d.chat_title}
                        </p>
                      )}
                    </div>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => stopDeployment(d.id)}
                      onKeyDown={(e) => { if (e.key === "Enter") stopDeployment(d.id); }}
                      className="shrink-0 cursor-pointer rounded p-1.5 text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive"
                      title="Stop and remove"
                    >
                      <TrashIcon className="size-3.5" />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pl-7">
                    {Object.entries(ports).map(([internal, external]) => (
                      <a
                        key={internal}
                        href={`http://localhost:${external}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border border-border/50 bg-muted/30 px-2 py-0.5 text-xs text-blue-400 transition-colors hover:bg-blue-500/10"
                      >
                        <ExternalLinkIcon className="size-3" />
                        :{internal} → :{external}
                      </a>
                    ))}
                    {d.workdir && (
                      <span className="text-[10px] text-muted-foreground font-mono">
                        /workspace/{d.workdir}
                      </span>
                    )}
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
