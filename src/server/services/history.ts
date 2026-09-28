import { getResource, RESOURCES, type ResourceDef } from "../../shared/resources.js";
import { inTransaction, type Db, type Queryable } from "../db/pool.js";
import { badRequest, conflict, forbidden, notFound } from "../errors.js";
import { recordActivity, type ActivityRow } from "./audit.js";
import type { CurrentUser } from "./auth.js";
import { describe, toActor, type Repository, type Row } from "./repository.js";
import { writeSettingsGroup } from "./settings.js";

const RECORD_ACTIONS = new Set(["create", "update", "delete", "restore", "reorder"]);

const identifier = (name: string) => `"${name.replace(/"/g, "")}"`;

/** Undo for the activity log, and the recycle bin built on soft deletes. */
export class HistoryService {
  constructor(
    private readonly db: Db,
    private readonly repository: Repository,
  ) {}

  async activity(query: { page?: number; resource?: string; recordId?: string }) {
    const limit = 50;
    const offset = (Math.max(query.page ?? 1, 1) - 1) * limit;
    const { rows } = await this.db.query<ActivityRow>(
      `SELECT id, created_at, user_id, user_name, action, resource, record_id, summary, undone_at,
              (before IS NOT NULL OR after IS NOT NULL) AS has_snapshot
       FROM activity_log
       WHERE ($1::text IS NULL OR resource = $1) AND ($2::text IS NULL OR record_id = $2)
       ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`,
      [query.resource ?? null, query.recordId ?? null],
    );
    return rows.map((row) => ({ ...row, undoable: isUndoable(row) }));
  }

  async undo(entryId: number, user: CurrentUser) {
    if (!user.permissions.has("activity.undo")) throw forbidden();
    return inTransaction(this.db, async (client) => {
      const { rows } = await client.query<ActivityRow>(
        "SELECT * FROM activity_log WHERE id = $1 FOR UPDATE",
        [entryId],
      );
      const entry = rows[0];
      if (!entry) throw notFound("Activity entry");
      if (entry.undone_at) throw conflict("This change has already been undone");
      if (!isUndoable(entry)) throw badRequest("This kind of change cannot be undone");

      if (entry.resource === "settings") {
        if (!user.permissions.has("settings.manage")) throw forbidden();
        await writeSettingsGroup(client, entry.record_id, entry.before);
      } else if (entry.resource === "student_skills") {
        await this.undoSkill(client, entry);
      } else {
        const def = getResource(entry.resource)!;
        if (!user.permissions.has(def.edit)) throw forbidden();
        await this.undoRecord(client, def, entry, user);
      }

      await client.query(
        "UPDATE activity_log SET undone_at = now(), undone_by = $2 WHERE id = $1",
        [entryId, user.id],
      );
      await recordActivity(client, toActor(user), {
        action: "undo",
        resource: entry.resource,
        recordId: entry.record_id,
        summary: `Undid: ${entry.summary}`,
      });
    });
  }

  private async undoRecord(
    client: Queryable,
    def: ResourceDef,
    entry: ActivityRow,
    user: CurrentUser,
  ) {
    const table = identifier(def.table);
    switch (entry.action) {
      case "create":
      case "restore": {
        const { rowCount } = await client.query(
          `UPDATE ${table} SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL`,
          [entry.record_id],
        );
        if (!rowCount) throw conflict("That item has already been deleted");
        return;
      }
      case "delete":
        await this.repository.restore(def, entry.record_id, toActor(user), client);
        return;
      case "update": {
        const current = await this.currentRow(client, def, entry.record_id);
        const after = entry.after as Row;
        if (timestamp(current.updated_at) !== timestamp(after.updated_at)) {
          throw conflict("This item has been changed since; undo the later changes first");
        }
        await this.repository.revertTo(client, def, entry.before as Row);
        return;
      }
      case "reorder":
        for (const [id, position] of Object.entries(entry.before ?? {})) {
          await client.query(`UPDATE ${table} SET position = $2 WHERE id = $1`, [id, position]);
        }
        return;
    }
  }

  private async undoSkill(client: Queryable, entry: ActivityRow) {
    const [studentId, skillId] = entry.record_id.split(":");
    await client.query(
      "UPDATE student_skills SET level = $3, updated_at = now() WHERE student_id = $1 AND skill_id = $2",
      [studentId, skillId, (entry.before as { level: string }).level],
    );
  }

  private async currentRow(client: Queryable, def: ResourceDef, id: string): Promise<Row> {
    const { rows } = await client.query<Row>(
      `SELECT * FROM ${identifier(def.table)} WHERE id = $1`,
      [id],
    );
    if (!rows[0]) throw notFound(def.singular);
    return rows[0];
  }

  /** Soft-deleted items from every resource the user may edit, newest first. */
  async recycleBin(user: CurrentUser) {
    const editable = RESOURCES.filter((def) => user.permissions.has(def.edit));
    const results = await Promise.all(
      editable.map(async (def) => {
        const { rows } = await this.db.query<Row>(
          `SELECT * FROM ${identifier(def.table)} WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 100`,
        );
        return rows.map((row) => ({
          resource: def.name,
          resource_label: def.singular,
          id: row.id,
          title: describe(def, row) || def.singular,
          deleted_at: row.deleted_at,
        }));
      }),
    );
    return results.flat().sort((a, b) => String(b.deleted_at).localeCompare(String(a.deleted_at)));
  }

  async restore(resource: string, id: string, user: CurrentUser) {
    if (!user.permissions.has("recycle.restore")) throw forbidden();
    const def = getResource(resource);
    if (!def) throw notFound("Section");
    if (!user.permissions.has(def.edit)) throw forbidden();
    return this.repository.restore(def, id, toActor(user));
  }

  /** Permanently removes a deleted item. Owner only, and refused while other records still point at it. */
  async purge(resource: string, id: string, user: CurrentUser) {
    if (user.role !== "owner") throw forbidden("Only the owner can permanently delete items");
    const def = getResource(resource);
    if (!def) throw notFound("Section");
    try {
      const { rowCount } = await this.db.query(
        `DELETE FROM ${identifier(def.table)} WHERE id = $1 AND deleted_at IS NOT NULL`,
        [id],
      );
      if (!rowCount) throw notFound(`Deleted ${def.singular.toLowerCase()}`);
    } catch (error) {
      if ((error as { code?: string }).code === "23503") {
        throw conflict(
          "Other records still refer to this item, so it can only stay in the recycle bin",
        );
      }
      throw error;
    }
    await recordActivity(this.db, toActor(user), {
      action: "purge",
      resource,
      recordId: id,
      summary: `Permanently deleted a ${def.singular.toLowerCase()}`,
    });
  }
}

/** Snapshots store timestamps as ISO strings; live rows return Dates. */
function timestamp(value: unknown): number {
  return value instanceof Date ? value.getTime() : new Date(String(value)).getTime();
}

function isUndoable(entry: Pick<ActivityRow, "action" | "resource" | "undone_at">): boolean {
  if (entry.undone_at) return false;
  if (entry.resource === "settings" || entry.resource === "student_skills")
    return entry.action === "update";
  return Boolean(getResource(entry.resource)) && RECORD_ACTIONS.has(entry.action);
}
