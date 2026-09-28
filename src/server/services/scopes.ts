import type { Permission } from "../../shared/permissions.js";
import { hasAny } from "../../shared/permissions.js";
import type { CurrentUser } from "./auth.js";

/**
 * Instructors see only their own students and lessons. Each entry lists the permissions that
 * lift the restriction and the SQL condition (on alias `t`) that applies otherwise.
 */
interface Scope {
  fullAccess: Permission[];
  condition: (instructorParam: string) => string;
}

const ownStudents = (p: string) => `
  SELECT s.id FROM students s WHERE s.deleted_at IS NULL AND (s.instructor_id = ${p}
    OR EXISTS (SELECT 1 FROM bookings b WHERE b.student_id = s.id AND b.instructor_id = ${p} AND b.deleted_at IS NULL))`;

const SCOPES: Record<string, Scope> = {
  students: {
    fullAccess: ["students.view", "students.manage", "finance.view"],
    condition: (p) => `t.id IN (${ownStudents(p)})`,
  },
  bookings: {
    fullAccess: ["bookings.view", "bookings.manage"],
    condition: (p) => `t.instructor_id = ${p}`,
  },
  official_tests: {
    fullAccess: ["tests.manage", "students.view"],
    condition: (p) => `(t.instructor_id = ${p} OR t.student_id IN (${ownStudents(p)}))`,
  },
  student_documents: {
    fullAccess: ["students.view", "students.manage"],
    condition: (p) => `t.student_id IN (${ownStudents(p)})`,
  },
  student_notes: {
    fullAccess: ["students.view", "students.manage"],
    condition: (p) => `t.student_id IN (${ownStudents(p)})`,
  },
};

export interface ScopeClause {
  sql: string;
  params: unknown[];
}

/** Returns the row filter for this user, or null when they may see every row. */
export function scopeFor(
  resource: string,
  user: CurrentUser,
  paramIndex: number,
): ScopeClause | null {
  const scope = SCOPES[resource];
  if (!scope || hasAny(user.permissions, ...scope.fullAccess)) return null;
  return { sql: scope.condition(`$${paramIndex}`), params: [user.instructorId] };
}
