import { getDb } from "@/lib/db";
import { nanoid } from "nanoid";

export async function GET() {
  const db = getDb();
  const tasks = db
    .prepare("SELECT * FROM tasks ORDER BY created_at DESC")
    .all();
  return Response.json({ tasks });
}

export async function POST(req: Request) {
  const { title, status, sandbox_id, metadata, scheduled_at } = await req.json();
  const db = getDb();
  const id = nanoid(12);
  db.prepare(
    "INSERT INTO tasks (id, title, status, sandbox_id, metadata, scheduled_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, title, status || "pending", sandbox_id || null, JSON.stringify(metadata || {}), scheduled_at || null);
  return Response.json({ id, title, status: status || "pending" });
}
