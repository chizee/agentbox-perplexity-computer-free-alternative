import { getDb } from "@/lib/db";
import { nanoid } from "nanoid";

export async function GET() {
  const db = getDb();
  const chats = db
    .prepare("SELECT id, title, created_at, updated_at FROM chats ORDER BY updated_at DESC")
    .all();
  return Response.json({ chats });
}

export async function POST(req: Request) {
  const { title, messages } = await req.json();
  const db = getDb();
  const id = nanoid(12);
  db.prepare(
    "INSERT INTO chats (id, title, messages) VALUES (?, ?, ?)"
  ).run(id, title || "New Chat", JSON.stringify(messages || []));
  return Response.json({ id, title });
}
