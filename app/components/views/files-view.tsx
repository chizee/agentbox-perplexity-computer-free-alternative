"use client";

import { useEffect, useState } from "react";
import { FolderIcon, FileIcon, HardDriveIcon, MessageSquareIcon, ArrowLeftIcon } from "lucide-react";

interface Volume {
  id: string;
  title: string;
  volume_name: string;
  updated_at: string;
}

interface FileEntry {
  name: string;
  type: "file" | "directory";
  size: number;
  modified: string;
}

export function FilesView() {
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [selectedTitle, setSelectedTitle] = useState<string>("");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [currentPath, setCurrentPath] = useState("/workspace");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/volumes");
        const data = await res.json();
        setVolumes(data.volumes || []);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (!selectedChatId) return;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/volumes/${selectedChatId}?path=${encodeURIComponent(currentPath)}`);
        const data = await res.json();
        setFiles(data.entries || []);
      } catch {
        setFiles([]);
      }
      setLoading(false);
    })();
  }, [selectedChatId, currentPath]);

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/50 px-6 py-4">
        <h2 className="text-lg font-medium">Files</h2>
        <p className="text-sm text-muted-foreground">
          {selectedChatId ? `Browsing: ${selectedTitle}` : "Chat workspaces"}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4">
        {!selectedChatId ? (
          volumes.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 pt-20 text-muted-foreground">
              <HardDriveIcon className="size-10 opacity-30" />
              <p className="text-sm">No workspaces yet</p>
              <p className="text-xs">Chats with agent tasks will appear here</p>
            </div>
          ) : (
            <div className="mx-auto grid max-w-3xl gap-2">
              {volumes.map((v) => (
                <div
                  key={v.id}
                  onClick={() => { setSelectedChatId(v.id); setSelectedTitle(v.title); setCurrentPath("/workspace"); }}
                  className="group flex w-full min-w-0 cursor-pointer items-center gap-3 rounded-lg border border-border/50 px-4 py-3 transition-colors hover:bg-muted/50"
                >
                  <MessageSquareIcon className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{v.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(v.updated_at).toLocaleString(undefined, {
                        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="mx-auto max-w-3xl">
            <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
              <button
                onClick={() => { setSelectedChatId(null); setFiles([]); setCurrentPath("/workspace"); }}
                className="flex items-center gap-1 hover:text-foreground"
              >
                <ArrowLeftIcon className="size-3" />
                Back
              </button>
              <span>/</span>
              <span className="truncate">{currentPath}</span>
              {currentPath !== "/workspace" && (
                <button
                  onClick={() => {
                    const parent = currentPath.split("/").slice(0, -1).join("/") || "/workspace";
                    setCurrentPath(parent);
                  }}
                  className="ml-auto hover:text-foreground"
                >
                  ..
                </button>
              )}
            </div>
            <div className="grid gap-1">
              {loading ? (
                <p className="py-4 text-center text-xs text-muted-foreground">Loading...</p>
              ) : files.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">Empty directory</p>
              ) : (
                files.map((f) => (
                  <div
                    key={f.name}
                    onClick={() => {
                      if (f.type === "directory") setCurrentPath(`${currentPath}/${f.name}`);
                    }}
                    className={`flex items-center justify-between rounded-md px-3 py-2 text-sm ${
                      f.type === "directory" ? "cursor-pointer hover:bg-muted/50" : ""
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      {f.type === "directory" ? (
                        <FolderIcon className="size-4 shrink-0 text-yellow-500/70" />
                      ) : (
                        <FileIcon className="size-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="truncate">{f.name}</span>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {f.type === "file" ? formatSize(f.size) : ""}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
