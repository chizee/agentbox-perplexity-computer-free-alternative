import Database from "better-sqlite3";
import path from "path";
import type { UIMessage } from "ai";

const DB_PATH = path.join(process.cwd(), "data", "agentbox.db");

let db: Database.Database | null = null;

export function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initTables(db);
  }
  return db;
}

function initTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'New Chat',
      messages TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'idle',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      volume_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS deployments (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('static', 'node', 'python')),
      workdir TEXT DEFAULT '',
      command TEXT DEFAULT '',
      ports TEXT NOT NULL DEFAULT '[]',
      published_ports TEXT NOT NULL DEFAULT '{}',
      container_id TEXT NOT NULL,
      volume_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'completed', 'failed', 'scheduled')),
      sandbox_id TEXT,
      metadata TEXT DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      scheduled_at TEXT
    );
  `);

  // Migration: add status column if it doesn't exist
  try {
    db.exec(`ALTER TABLE chats ADD COLUMN status TEXT NOT NULL DEFAULT 'idle'`);
  } catch {
    // Column already exists
  }
}

// --- Chat helpers ---

export function loadChat(chatId: string): UIMessage[] {
  const db = getDb();
  const row = db.prepare("SELECT messages FROM chats WHERE id = ?").get(chatId) as { messages: string } | undefined;
  if (!row) return [];
  try {
    return typeof row.messages === "string" ? JSON.parse(row.messages) : row.messages;
  } catch {
    return [];
  }
}

export function saveChat(chatId: string, messages: UIMessage[]) {
  const db = getDb();
  const existing = db.prepare("SELECT id FROM chats WHERE id = ?").get(chatId);
  if (existing) {
    db.prepare("UPDATE chats SET messages = ?, updated_at = datetime('now') WHERE id = ?")
      .run(JSON.stringify(messages), chatId);
  } else {
    db.prepare("INSERT INTO chats (id, messages) VALUES (?, ?)")
      .run(chatId, JSON.stringify(messages));
  }
}

export function updateChatStatus(chatId: string, status: "idle" | "streaming" | "completed") {
  const db = getDb();
  db.prepare("UPDATE chats SET status = ?, updated_at = datetime('now') WHERE id = ?")
    .run(status, chatId);
}

export function appendAgentActivity(chatId: string, activity: any) {
  const db = getDb();
  const row = db.prepare("SELECT messages FROM chats WHERE id = ?").get(chatId) as { messages: string } | undefined;
  if (!row) return;
  try {
    const messages = JSON.parse(row.messages);
    // Find or create a trailing assistant message to attach activities to
    let lastAssistant = messages[messages.length - 1];
    if (!lastAssistant || lastAssistant.role !== "assistant") {
      lastAssistant = {
        id: `pending-${Date.now()}`,
        role: "assistant",
        parts: [],
      };
      messages.push(lastAssistant);
    }
    if (!lastAssistant.parts) lastAssistant.parts = [];
    lastAssistant.parts.push({ type: "data-agent-activity", data: activity });
    db.prepare("UPDATE chats SET messages = ?, updated_at = datetime('now') WHERE id = ?")
      .run(JSON.stringify(messages), chatId);
  } catch {}
}

export function appendVncLink(chatId: string, vncData: any) {
  const db = getDb();
  const row = db.prepare("SELECT messages FROM chats WHERE id = ?").get(chatId) as { messages: string } | undefined;
  if (!row) return;
  try {
    const messages = JSON.parse(row.messages);
    let lastAssistant = messages[messages.length - 1];
    if (!lastAssistant || lastAssistant.role !== "assistant") {
      lastAssistant = {
        id: `pending-${Date.now()}`,
        role: "assistant",
        parts: [],
      };
      messages.push(lastAssistant);
    }
    if (!lastAssistant.parts) lastAssistant.parts = [];
    lastAssistant.parts.push({ type: "data-vnc-link", data: vncData });
    db.prepare("UPDATE chats SET messages = ?, updated_at = datetime('now') WHERE id = ?")
      .run(JSON.stringify(messages), chatId);
  } catch {}
}

// --- Deployment helpers ---

export interface DeploymentRow {
  id: string;
  chat_id: string;
  name: string;
  type: string;
  workdir: string;
  command: string;
  ports: string;
  published_ports: string;
  container_id: string;
  volume_name: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export function saveDeployment(row: Omit<DeploymentRow, "created_at" | "updated_at">) {
  const db = getDb();
  db.prepare(
    `INSERT INTO deployments (id, chat_id, name, type, workdir, command, ports, published_ports, container_id, volume_name, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    row.id,
    row.chat_id,
    row.name,
    row.type,
    row.workdir,
    row.command,
    row.ports,
    row.published_ports,
    row.container_id,
    row.volume_name,
    row.status
  );
}

export function listDeployments() {
  const db = getDb();
  return db
    .prepare(
      `SELECT d.*, c.title AS chat_title
       FROM deployments d
       LEFT JOIN chats c ON c.id = d.chat_id
       ORDER BY d.created_at DESC`
    )
    .all();
}

export function listDeploymentsForChat(chatId: string) {
  const db = getDb();
  return db
    .prepare("SELECT * FROM deployments WHERE chat_id = ? ORDER BY created_at DESC")
    .all(chatId);
}

export function getDeployment(id: string): DeploymentRow | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM deployments WHERE id = ?").get(id) as DeploymentRow | undefined;
}

export function deleteDeployment(id: string) {
  const db = getDb();
  db.prepare("DELETE FROM deployments WHERE id = ?").run(id);
}

export function updateDeploymentStatus(id: string, status: string) {
  const db = getDb();
  db.prepare("UPDATE deployments SET status = ?, updated_at = datetime('now') WHERE id = ?")
    .run(status, id);
}

export function getChatStatus(chatId: string): string {
  const db = getDb();
  const row = db.prepare("SELECT status FROM chats WHERE id = ?").get(chatId) as { status: string } | undefined;
  return row?.status || "idle";
}
