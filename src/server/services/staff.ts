import {
  PERMISSIONS,
  type Permission,
  type PermissionOverrides,
} from "../../shared/permissions.js";
import { STAFF_FIELDS } from "../../shared/staff.js";
import { validate } from "../../shared/validation.js";
import { inTransaction, type Db, type Queryable } from "../db/pool.js";
import { badRequest, conflict, forbidden, notFound, PG, pgCode } from "../errors.js";
import { recordActivity } from "./audit.js";
import { destroyUserSessions, type CurrentUser } from "./auth.js";
import { hashPassword } from "./passwords.js";
import { toActor } from "./repository.js";

const PUBLIC_COLUMNS =
  "id, name, email, phone, role, active, permission_overrides, last_login_at, created_at";

function assertOwner(user: CurrentUser) {
  if (user.role !== "owner") throw forbidden("Only the owner can manage staff and access rights");
}

function cleanOverrides(input: unknown): PermissionOverrides {
  if (typeof input !== "object" || input === null) throw badRequest("Invalid access settings");
  const overrides: PermissionOverrides = {};
  for (const [permission, allowed] of Object.entries(input)) {
    if (!(permission in PERMISSIONS)) throw badRequest(`Unknown permission: ${permission}`);
    if (typeof allowed !== "boolean") throw badRequest("Access settings must be on or off");
    overrides[permission as Permission] = allowed;
  }
  return overrides;
}

export class StaffService {
  constructor(private readonly db: Db) {}

  async list(user: CurrentUser) {
    assertOwner(user);
    const { rows } = await this.db.query(
      `SELECT ${PUBLIC_COLUMNS} FROM users WHERE role <> 'student' AND deleted_at IS NULL ORDER BY name`,
    );
    return rows;
  }

  /** Staff accounts that can be linked to an instructor profile. */
  async options(user: CurrentUser) {
    if (user.role !== "owner" && !user.permissions.has("instructors.manage")) throw forbidden();
    const { rows } = await this.db.query(
      "SELECT id AS value, name || ' (' || email || ')' AS label FROM users WHERE role <> 'student' AND deleted_at IS NULL ORDER BY name",
    );
    return rows;
  }

  async save(user: CurrentUser, id: string | null, input: unknown) {
    assertOwner(user);
    const result = validate(STAFF_FIELDS, input, id ? "update" : "create");
    if (!result.ok) throw badRequest("Please correct the highlighted fields", result.errors);
    const { password, ...data } = result.data as Record<string, unknown> & {
      password?: string | null;
    };
    const overrides =
      input && typeof input === "object" && "permission_overrides" in input
        ? cleanOverrides((input as { permission_overrides: unknown }).permission_overrides)
        : undefined;
    if (!id && !password)
      throw badRequest("Set a password for the new account", { password: "Required" });

    return inTransaction(this.db, async (client) => {
      const before = id ? await this.find(client, id) : null;
      if (before && (data.role !== undefined || data.active !== undefined)) {
        const stillOwner = (data.role ?? before.role) === "owner" && (data.active ?? before.active);
        if (before.role === "owner" && !stillOwner) await this.assertAnotherOwner(client, id!);
      }

      const values: Record<string, unknown> = { ...data };
      if (password) values.password_hash = await hashPassword(password);
      if (overrides) values.permission_overrides = JSON.stringify(overrides);
      const columns = Object.keys(values);

      try {
        const { rows } = id
          ? await client.query(
              `UPDATE users SET ${columns.map((c, i) => `${c} = $${i + 2}`).join(", ")}, updated_at = now()
               WHERE id = $1 AND role <> 'student' AND deleted_at IS NULL RETURNING ${PUBLIC_COLUMNS}`,
              [id, ...columns.map((c) => values[c])],
            )
          : await client.query(
              `INSERT INTO users (${columns.join(", ")}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(", ")})
               RETURNING ${PUBLIC_COLUMNS}`,
              columns.map((c) => values[c]),
            );
        const saved = rows[0];
        if (!saved) throw notFound("Staff member");
        if (before && (password || data.active === false || data.role !== undefined)) {
          await destroyUserSessions(client, saved.id);
        }
        await recordActivity(client, toActor(user), {
          action: id ? "update" : "create",
          resource: "staff",
          recordId: saved.id,
          summary: `${id ? "Updated" : "Added"} staff account “${saved.name}” (${saved.role})`,
          before: before ?? undefined,
          after: saved,
        });
        return saved;
      } catch (error) {
        if (pgCode(error) === PG.uniqueViolation) {
          throw conflict("That email is already used by another login", {
            email: "Already in use",
          });
        }
        throw error;
      }
    });
  }

  async remove(user: CurrentUser, id: string) {
    assertOwner(user);
    if (id === user.id) throw badRequest("You cannot delete your own account");
    await inTransaction(this.db, async (client) => {
      const before = await this.find(client, id);
      if (before.role === "owner") await this.assertAnotherOwner(client, id);
      await client.query("UPDATE users SET deleted_at = now(), active = false WHERE id = $1", [id]);
      await client.query("DELETE FROM sessions WHERE user_id = $1", [id]);
      await recordActivity(client, toActor(user), {
        action: "delete",
        resource: "staff",
        recordId: id,
        summary: `Removed staff account “${before.name}”`,
        before,
      });
    });
  }

  private async find(db: Queryable, id: string) {
    const { rows } = await db.query(
      `SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1 AND role <> 'student' AND deleted_at IS NULL FOR UPDATE`,
      [id],
    );
    if (!rows[0]) throw notFound("Staff member");
    return rows[0];
  }

  private async assertAnotherOwner(db: Queryable, exceptId: string) {
    const { rows } = await db.query(
      "SELECT 1 FROM users WHERE role = 'owner' AND active AND deleted_at IS NULL AND id <> $1 LIMIT 1",
      [exceptId],
    );
    if (!rows.length) throw badRequest("The business needs at least one active owner");
  }
}
