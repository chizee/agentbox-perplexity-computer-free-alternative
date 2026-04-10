import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  // Join chats with sessions to get volume name + chat title
  const rows = db
    .prepare(
      `SELECT c.id, c.title, c.updated_at, s.volume_name
       FROM chats c
       INNER JOIN sessions s ON s.chat_id = c.id
       ORDER BY c.updated_at DESC`
    )
    .all();
  return Response.json({ volumes: rows });
}
