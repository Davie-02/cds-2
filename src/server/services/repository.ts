import type pg from "pg";
import { getResource, type ResourceDef } from "../../shared/resources.js";
import { validate, type Mode } from "../../shared/validation.js";
import { hasAny } from "../../shared/permissions.js";
import { inTransaction, type Db, type Queryable } from "../db/pool.js";
import { PG, badRequest, conflict, forbidden, notFound, pgCode, pgConstraint } from "../errors.js";
import { recordActivity, type Actor } from "./audit.js";
import type { CurrentUser } from "./auth.js";
import { scopeFor } from "./scopes.js";

export type Row = Record<string, unknown> & { id: string };

export interface HookContext {
  db: Queryable;
  user: CurrentUser | null;
  mode: Mode;
  existing: Row | null;
  /** The unvalidated request body, for hooks that validate extra structures themselves. */
  input?: unknown;
}

/** Resource-specific behaviour layered on top of the generic field-list CRUD. */
export interface ResourceHooks {
  /** Columns the hook may write in addition to the declared fields. */
  extraColumns?: string[];
  /** Extra columns stored as jsonb. */
  jsonColumns?: string[];
  /** Adjusts or enriches validated data before it is written. May throw HttpErrors. */
  prepare?(data: Record<string, unknown>, ctx: HookContext): Promise<Record<string, unknown>>;
  /** Runs in the same transaction after a create or update. */
  afterWrite?(row: Row, ctx: HookContext): Promise<void>;
  /** Throw to refuse a delete, e.g. system pages. */
  beforeDelete?(row: Row, ctx: HookContext): Promise<void>;
}

export interface ListQuery {
  search?: string;
  filters?: Record<string, string>;
  page?: number;
  limit?: number;
}

const JSON_TYPES = new Set(["list"]);
const identifier = (name: string) => `"${name.replace(/"/g, "")}"`;

export class Repository {
  constructor(
    private readonly db: Db,
    private readonly hooks: Record<string, ResourceHooks> = {},
  ) {}

  canView(def: ResourceDef, user: CurrentUser): boolean {
    return hasAny(user.permissions, ...def.view);
  }

  assertCanView(def: ResourceDef, user: CurrentUser): void {
    if (!this.canView(def, user)) throw forbidden();
  }

  assertCanEdit(def: ResourceDef, user: CurrentUser): void {
    if (!user.permissions.has(def.edit)) throw forbidden();
  }

  private writableColumns(def: ResourceDef): Set<string> {
    const columns = def.fields.filter((field) => !field.readOnly).map((field) => field.name);
    return new Set([...columns, ...(this.hooks[def.name]?.extraColumns ?? [])]);
  }

  private jsonColumns(def: ResourceDef): Set<string> {
    const columns = def.fields
      .filter((field) => JSON_TYPES.has(field.type))
      .map((field) => field.name);
    return new Set([...columns, ...(this.hooks[def.name]?.jsonColumns ?? [])]);
  }

  private serialize(def: ResourceDef, column: string, value: unknown): unknown {
    return this.jsonColumns(def).has(column) && value !== null && value !== undefined
      ? JSON.stringify(value)
      : value;
  }

  async list(def: ResourceDef, user: CurrentUser, query: ListQuery = {}) {
    this.assertCanView(def, user);
    const params: unknown[] = [];
    const where = ["t.deleted_at IS NULL"];

    const scope = scopeFor(def.name, user, params.length + 1);
    if (scope) {
      where.push(scope.sql);
      params.push(...scope.params);
    }

    const search = query.search?.trim();
    if (search && def.search?.length) {
      params.push(`%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
      where.push(
        `(${def.search.map((column) => `t.${identifier(column)}::text ILIKE $${params.length}`).join(" OR ")})`,
      );
    }

    for (const [name, value] of Object.entries(query.filters ?? {})) {
      const field = def.fields.find((f) => f.name === name);
      if (!field || !["select", "reference", "boolean", "text"].includes(field.type)) continue;
      params.push(field.type === "boolean" ? value === "true" : value);
      where.push(`t.${identifier(name)} = $${params.length}`);
    }

    const limit = Math.min(Math.max(query.limit ?? 50, 1), 500);
    const offset = (Math.max(query.page ?? 1, 1) - 1) * limit;
    const order = def.sortable
      ? "t.position, t.created_at"
      : def.sort
        ? `t.${identifier(def.sort.field)} ${def.sort.direction === "desc" ? "DESC" : "ASC"} NULLS LAST, t.created_at DESC`
        : "t.created_at DESC";

    const whereSql = where.join(" AND ");
    const [items, count] = await Promise.all([
      this.db.query<Row>(
        `SELECT t.* FROM ${identifier(def.table)} t WHERE ${whereSql} ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`,
        params,
      ),
      this.db.query<{ count: number }>(
        `SELECT count(*) FROM ${identifier(def.table)} t WHERE ${whereSql}`,
        params,
      ),
    ]);
    return { items: items.rows, total: count.rows[0]?.count ?? 0 };
  }

  async get(
    def: ResourceDef,
    id: string,
    user: CurrentUser | null,
    db: Queryable = this.db,
  ): Promise<Row> {
    if (user) this.assertCanView(def, user);
    const params: unknown[] = [id];
    let scopeSql = "";
    if (user) {
      const scope = scopeFor(def.name, user, 2);
      if (scope) {
        scopeSql = ` AND ${scope.sql}`;
        params.push(...scope.params);
      }
    }
    const { rows } = await db.query<Row>(
      `SELECT t.* FROM ${identifier(def.table)} t WHERE t.id = $1 AND t.deleted_at IS NULL${scopeSql}`,
      params,
    );
    if (!rows[0]) throw notFound(def.singular);
    return rows[0];
  }

  async options(def: ResourceDef, user: CurrentUser) {
    const { items } = await this.list(def, user, { limit: 500 });
    return items.map((row) => ({ value: row.id, label: String(row[def.title] ?? row.id) }));
  }

  async create(
    def: ResourceDef,
    input: unknown,
    actor: CurrentUser | null,
    preset: Record<string, unknown> = {},
  ) {
    if (actor) this.assertCanEdit(def, actor);
    return inTransaction(this.db, (client) => this.createWith(client, def, input, actor, preset));
  }

  /**
   * Creates inside an existing transaction. `preset` values are server-set and skip validation.
   * `actor` controls access checks (null for trusted server code); `auditActor` is who the log names.
   */
  async createWith(
    client: Queryable,
    def: ResourceDef,
    input: unknown,
    actor: CurrentUser | null,
    preset: Record<string, unknown> = {},
    auditActor: Actor = toActor(actor),
  ): Promise<Row> {
    const data = await this.prepare(client, def, input, actor, "create", null);
    Object.assign(data, preset);
    if (def.sortable && data.position === undefined) {
      const { rows } = await client.query<{ next: number }>(
        `SELECT coalesce(max(position), -1) + 1 AS next FROM ${identifier(def.table)} WHERE deleted_at IS NULL`,
      );
      data.position = rows[0]?.next ?? 0;
    }
    const columns = Object.keys(data);
    const row = await this.run(def, () =>
      client.query<Row>(
        `INSERT INTO ${identifier(def.table)} (${columns.map(identifier).join(", ")})
         VALUES (${columns.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING *`,
        columns.map((column) => this.serialize(def, column, data[column])),
      ),
    );
    await this.afterWrite(client, def, row, actor, "create", null);
    await recordActivity(client, auditActor, {
      action: "create",
      resource: def.name,
      recordId: row.id,
      summary: `Added ${def.singular.toLowerCase()} ${describe(def, row)}`,
      after: row,
    });
    return row;
  }

  async update(def: ResourceDef, id: string, input: unknown, actor: CurrentUser | null) {
    if (actor) this.assertCanEdit(def, actor);
    return inTransaction(this.db, (client) => this.updateWith(client, def, id, input, actor));
  }

  async updateWith(
    client: Queryable,
    def: ResourceDef,
    id: string,
    input: unknown,
    actor: CurrentUser | null,
    auditActor: Actor = toActor(actor),
  ) {
    const existing = await this.lockRow(client, def, id, actor);
    const data = await this.prepare(client, def, input, actor, "update", existing);
    const columns = Object.keys(data);
    if (!columns.length) return existing;
    const row = await this.run(def, () =>
      client.query<Row>(
        `UPDATE ${identifier(def.table)} SET ${columns.map((c, i) => `${identifier(c)} = $${i + 2}`).join(", ")},
           updated_at = now() WHERE id = $1 RETURNING *`,
        [id, ...columns.map((column) => this.serialize(def, column, data[column]))],
      ),
    );
    await this.afterWrite(client, def, row, actor, "update", existing);
    await recordActivity(client, auditActor, {
      action: "update",
      resource: def.name,
      recordId: id,
      summary: `Edited ${def.singular.toLowerCase()} ${describe(def, row)}`,
      before: existing,
      after: row,
    });
    return row;
  }

  async remove(def: ResourceDef, id: string, actor: CurrentUser | null): Promise<void> {
    if (actor) this.assertCanEdit(def, actor);
    await inTransaction(this.db, async (client) => {
      const existing = await this.lockRow(client, def, id, actor);
      await this.hooks[def.name]?.beforeDelete?.(existing, {
        db: client,
        user: actor,
        mode: "update",
        existing,
      });
      await client.query(`UPDATE ${identifier(def.table)} SET deleted_at = now() WHERE id = $1`, [
        id,
      ]);
      await recordActivity(client, toActor(actor), {
        action: "delete",
        resource: def.name,
        recordId: id,
        summary: `Deleted ${def.singular.toLowerCase()} ${describe(def, existing)}`,
        before: existing,
      });
    });
  }

  async restore(
    def: ResourceDef,
    id: string,
    actor: Actor,
    client: Queryable = this.db,
  ): Promise<Row> {
    const row = await this.run(def, async () => {
      const result = await client.query<Row>(
        `UPDATE ${identifier(def.table)} SET deleted_at = NULL, updated_at = now()
         WHERE id = $1 AND deleted_at IS NOT NULL RETURNING *`,
        [id],
      );
      if (!result.rows[0]) throw notFound(`Deleted ${def.singular.toLowerCase()}`);
      return result;
    });
    await recordActivity(client, actor, {
      action: "restore",
      resource: def.name,
      recordId: id,
      summary: `Restored ${def.singular.toLowerCase()} ${describe(def, row)}`,
      after: row,
    });
    return row;
  }

  /** Writes a previous snapshot back, used by undo. Only declared columns are touched. */
  async revertTo(client: Queryable, def: ResourceDef, snapshot: Row): Promise<Row> {
    const columns = [...this.writableColumns(def), ...(def.sortable ? ["position"] : [])].filter(
      (column) => column in snapshot,
    );
    return this.run(def, async () => {
      const result = await client.query<Row>(
        `UPDATE ${identifier(def.table)} SET ${columns.map((c, i) => `${identifier(c)} = $${i + 2}`).join(", ")},
           updated_at = now() WHERE id = $1 RETURNING *`,
        [snapshot.id, ...columns.map((column) => this.serialize(def, column, snapshot[column]))],
      );
      if (!result.rows[0]) throw notFound(def.singular);
      return result;
    });
  }

  async reorder(def: ResourceDef, ids: string[], actor: CurrentUser): Promise<void> {
    this.assertCanEdit(def, actor);
    if (!def.sortable) throw badRequest(`${def.label} cannot be reordered`);
    await inTransaction(this.db, async (client) => {
      const { rows } = await client.query<{ id: string; position: number }>(
        `SELECT id, position FROM ${identifier(def.table)} WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`,
        [ids],
      );
      if (rows.length !== ids.length)
        throw badRequest("Some items no longer exist; reload and try again");
      const sortedPositions = rows.map((row) => row.position).sort((a, b) => a - b);
      const before = Object.fromEntries(rows.map((row) => [row.id, row.position]));
      const after = Object.fromEntries(ids.map((id, index) => [id, sortedPositions[index]!]));
      for (const [id, position] of Object.entries(after)) {
        await client.query(`UPDATE ${identifier(def.table)} SET position = $2 WHERE id = $1`, [
          id,
          position,
        ]);
      }
      await recordActivity(client, toActor(actor), {
        action: "reorder",
        resource: def.name,
        recordId: ids[0]!,
        summary: `Reordered ${def.label.toLowerCase()}`,
        before,
        after,
      });
    });
  }

  private async lockRow(
    client: Queryable,
    def: ResourceDef,
    id: string,
    actor: CurrentUser | null,
  ) {
    const existing = await this.get(def, id, actor, client);
    await client.query(`SELECT 1 FROM ${identifier(def.table)} WHERE id = $1 FOR UPDATE`, [id]);
    return existing;
  }

  private async prepare(
    client: Queryable,
    def: ResourceDef,
    input: unknown,
    actor: CurrentUser | null,
    mode: Mode,
    existing: Row | null,
  ): Promise<Record<string, unknown>> {
    const result = validate(def.fields, input, mode);
    if (!result.ok) throw badRequest("Please correct the highlighted fields", result.errors);
    const hooks = this.hooks[def.name];
    const prepared = hooks?.prepare
      ? await hooks.prepare(result.data, { db: client, user: actor, mode, existing, input })
      : result.data;
    const allowed = this.writableColumns(def);
    return Object.fromEntries(
      Object.entries(prepared).filter(([key]) => allowed.has(key) || key === "position"),
    );
  }

  private async afterWrite(
    client: Queryable,
    def: ResourceDef,
    row: Row,
    actor: CurrentUser | null,
    mode: Mode,
    existing: Row | null,
  ) {
    await this.hooks[def.name]?.afterWrite?.(row, { db: client, user: actor, mode, existing });
    if (actor && scopeFor(def.name, actor, 2)) {
      // A scoped user may only create or edit rows they would be able to see afterwards.
      await this.get(def, row.id, actor, client).catch(() => {
        throw forbidden("You can only change records for your own students");
      });
    }
  }

  /** Runs a write and converts constraint violations into messages staff can act on. */
  private async run(def: ResourceDef, write: () => Promise<pg.QueryResult<Row>>): Promise<Row> {
    try {
      const result = await write();
      return result.rows[0]!;
    } catch (error) {
      throw translateDbError(def, error);
    }
  }
}

export function translateDbError(def: ResourceDef, error: unknown): unknown {
  switch (pgCode(error)) {
    case PG.uniqueViolation:
      return conflict(
        `Another ${def.singular.toLowerCase()} already uses that value`,
        uniqueFieldError(error),
      );
    case PG.foreignKeyViolation:
      return badRequest("A linked item does not exist or has been deleted");
    case PG.exclusionViolation:
      return conflict(overlapMessage(pgConstraint(error)));
    default:
      return error;
  }
}

function uniqueFieldError(error: unknown) {
  const constraint = pgConstraint(error) ?? "";
  const field = ["slug", "email", "plate", "number"].find((name) => constraint.includes(name));
  return field ? { [field]: "Already in use" } : undefined;
}

export function overlapMessage(constraint: string | undefined): string {
  if (constraint?.includes("vehicle")) return "That vehicle is already booked at this time";
  if (constraint?.includes("student")) return "The student already has a lesson at this time";
  return "The instructor already has a lesson at this time";
}

export function toActor(user: CurrentUser | null): Actor {
  return user ? { id: user.id, name: user.name } : { id: null, name: "System" };
}

export function describe(def: ResourceDef, row: Record<string, unknown>): string {
  const value = row[def.title];
  if (value instanceof Date) return value.toISOString().slice(0, 16).replace("T", " ");
  const text = value == null || value === "" ? "" : String(value);
  return text ? `“${text.length > 60 ? `${text.slice(0, 57)}…` : text}”` : "";
}

export function resourceOrThrow(name: string): ResourceDef {
  const def = getResource(name);
  if (!def) throw notFound("Section");
  return def;
}
