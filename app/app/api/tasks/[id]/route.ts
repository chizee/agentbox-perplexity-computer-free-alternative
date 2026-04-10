import { getDb } from "@/lib/db";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const db = getDb();

  const fields: string[] = [];
  const values: unknown[] = [];

  if (body.title !== undefined) { fields.push("title = ?"); values.push(body.title); }
  if (body.status !== undefined) { fields.push("status = ?"); values.push(body.status); }
  if (body.sandbox_id !== undefined) { fields.push("sandbox_id = ?"); values.push(body.sandbox_id); }
  if (body.metadata !== undefined) { fields.push("metadata = ?"); values.push(JSON.stringify(body.metadata)); }
  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE tasks SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  return Response.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
  return Response.json({ ok: true });
}
