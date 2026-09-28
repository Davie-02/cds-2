import { createHash, randomBytes } from "node:crypto";
import type { Db, Queryable } from "../db/pool.js";
import {
  effectivePermissions,
  type Permission,
  type PermissionOverrides,
  type Role,
} from "../../shared/permissions.js";
import { verifyPassword } from "./passwords.js";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  permissions: Set<Permission>;
  overrides: PermissionOverrides;
  /** Set when the user is linked to an instructor profile; limits "own" views to it. */
  instructorId: string | null;
  /** Set for student portal accounts. */
  studentId: string | null;
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(db: Db, userId: string, days: number): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.query(
    "INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, now() + make_interval(days => $3))",
    [hashToken(token), userId, days],
  );
  await db.query("UPDATE users SET last_login_at = now() WHERE id = $1", [userId]);
  return token;
}

export async function destroySession(db: Db, token: string): Promise<void> {
  await db.query("DELETE FROM sessions WHERE id = $1", [hashToken(token)]);
}

export async function destroyUserSessions(db: Queryable, userId: string): Promise<void> {
  await db.query("DELETE FROM sessions WHERE user_id = $1", [userId]);
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  permission_overrides: PermissionOverrides;
  instructor_id: string | null;
  student_id: string | null;
}

const USER_SELECT = `
  SELECT u.id, u.name, u.email, u.role, u.permission_overrides,
    (SELECT i.id FROM instructors i WHERE i.user_id = u.id AND i.deleted_at IS NULL LIMIT 1) AS instructor_id,
    (SELECT s.id FROM students s WHERE s.user_id = u.id AND s.deleted_at IS NULL LIMIT 1) AS student_id
  FROM users u`;

function toCurrentUser(row: UserRow): CurrentUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    overrides: row.permission_overrides,
    permissions: effectivePermissions(row.role, row.permission_overrides),
    instructorId: row.instructor_id,
    studentId: row.student_id,
  };
}

export async function userForSession(db: Db, token: string): Promise<CurrentUser | null> {
  const { rows } = await db.query<UserRow>(
    `${USER_SELECT}
     JOIN sessions s ON s.user_id = u.id
     WHERE s.id = $1 AND s.expires_at > now() AND u.active AND u.deleted_at IS NULL`,
    [hashToken(token)],
  );
  return rows[0] ? toCurrentUser(rows[0]) : null;
}

export async function loadUser(db: Db, id: string): Promise<CurrentUser | null> {
  const { rows } = await db.query<UserRow>(
    `${USER_SELECT} WHERE u.id = $1 AND u.deleted_at IS NULL`,
    [id],
  );
  return rows[0] ? toCurrentUser(rows[0]) : null;
}

/** Returns the user id when the credentials are valid, otherwise null. */
export async function checkCredentials(
  db: Db,
  email: string,
  password: string,
): Promise<string | null> {
  const { rows } = await db.query<{ id: string; password_hash: string }>(
    "SELECT id, password_hash FROM users WHERE lower(email) = lower($1) AND active AND deleted_at IS NULL",
    [email.trim()],
  );
  const user = rows[0];
  if (!user) return null;
  return (await verifyPassword(password, user.password_hash)) ? user.id : null;
}

export async function purgeExpiredSessions(db: Db): Promise<void> {
  await db.query("DELETE FROM sessions WHERE expires_at < now()");
}
