import type { Queryable } from "../db/pool.js";

export interface Actor {
  id: string | null;
  name: string;
}

export const SYSTEM_ACTOR: Actor = { id: null, name: "System" };

export type AuditAction = "create" | "update" | "delete" | "restore" | "reorder" | "undo" | "purge";

export interface AuditEntry {
  action: AuditAction;
  resource: string;
  recordId: string;
  summary: string;
  before?: unknown;
  after?: unknown;
}

export async function recordActivity(
  db: Queryable,
  actor: Actor,
  entry: AuditEntry,
): Promise<number> {
  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO activity_log (user_id, user_name, action, resource, record_id, summary, before, after)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [
      actor.id,
      actor.name,
      entry.action,
      entry.resource,
      entry.recordId,
      entry.summary,
      entry.before === undefined ? null : JSON.stringify(entry.before),
      entry.after === undefined ? null : JSON.stringify(entry.after),
    ],
  );
  return rows[0]!.id;
}

export interface ActivityRow {
  id: number;
  created_at: Date;
  user_id: string | null;
  user_name: string | null;
  action: AuditAction;
  resource: string;
  record_id: string;
  summary: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  undone_at: Date | null;
}
