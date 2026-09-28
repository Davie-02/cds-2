import type { Db, Queryable } from "../db/pool.js";
import { inTransaction } from "../db/pool.js";
import { badRequest, conflict, forbidden, notFound, PG, pgCode } from "../errors.js";
import { documentLabel, getResource } from "../../shared/resources.js";
import { validate } from "../../shared/validation.js";
import type { Field } from "../../shared/fields.js";
import { recordActivity } from "./audit.js";
import type { CurrentUser } from "./auth.js";
import { destroyUserSessions } from "./auth.js";
import { balances } from "./finance.js";
import { hashPassword } from "./passwords.js";
import type { ResourceHooks } from "./repository.js";
import { Repository, toActor } from "./repository.js";
import { loadSettings } from "./settings.js";

export const SKILL_LEVELS = ["not_started", "introduced", "practising", "competent"] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];

export const studentNoteHooks: ResourceHooks = {
  extraColumns: ["author_id", "author_name"],
  async prepare(data, { user, existing }) {
    if (existing) return data;
    return { ...data, author_id: user?.id ?? null, author_name: user?.name ?? null };
  },
};

export interface ReadinessCheck {
  label: string;
  done: boolean;
  detail: string;
}

export interface Readiness {
  ready: boolean;
  checks: ReadinessCheck[];
}

export class StudentService {
  constructor(
    private readonly db: Db,
    private readonly repository: Repository,
  ) {}

  private get def() {
    return getResource("students")!;
  }

  /** Everything the student screen shows, in one request. Access follows the same scoping as lists. */
  async profile(id: string, user: CurrentUser) {
    const student = await this.repository.get(this.def, id, user);
    const canSeeFinance = user.permissions.has("finance.view");
    const [skills, lessons, documents, notes, tests, attempts, readiness, finance, account] =
      await Promise.all([
        this.skills(id),
        this.db.query(
          `SELECT b.id, b.starts_at, b.ends_at, b.status, b.kind, b.lesson_notes, i.name AS instructor_name,
                v.plate AS vehicle_plate
         FROM bookings b JOIN instructors i ON i.id = b.instructor_id LEFT JOIN vehicles v ON v.id = b.vehicle_id
         WHERE b.student_id = $1 AND b.deleted_at IS NULL ORDER BY b.starts_at DESC`,
          [id],
        ),
        this.db.query(
          "SELECT * FROM student_documents WHERE student_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC",
          [id],
        ),
        this.db.query(
          "SELECT * FROM student_notes WHERE student_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC",
          [id],
        ),
        this.db.query(
          "SELECT * FROM official_tests WHERE student_id = $1 AND deleted_at IS NULL ORDER BY scheduled_at DESC",
          [id],
        ),
        this.db.query(
          `SELECT a.id, a.score, a.total, a.passed, a.submitted_at, t.name AS test_name, t.kind
         FROM theory_attempts a JOIN theory_tests t ON t.id = a.test_id
         WHERE a.student_id = $1 AND a.submitted_at IS NOT NULL ORDER BY a.submitted_at DESC`,
          [id],
        ),
        this.readiness(this.db, id),
        canSeeFinance ? this.finance(id) : Promise.resolve(null),
        this.db.query(
          "SELECT u.email, u.active FROM users u JOIN students s ON s.user_id = u.id WHERE s.id = $1",
          [id],
        ),
      ]);
    return {
      student,
      skills,
      lessons: lessons.rows,
      documents: documents.rows,
      notes: notes.rows,
      tests: tests.rows,
      attempts: attempts.rows,
      readiness,
      finance,
      portal_account: account.rows[0] ?? null,
    };
  }

  private async finance(studentId: string) {
    const [balance, invoices, payments] = await Promise.all([
      balances(this.db, studentId),
      this.db.query(
        "SELECT * FROM invoices WHERE student_id = $1 AND deleted_at IS NULL ORDER BY issued_on DESC",
        [studentId],
      ),
      this.db.query(
        "SELECT * FROM payments WHERE student_id = $1 AND deleted_at IS NULL ORDER BY paid_on DESC",
        [studentId],
      ),
    ]);
    return { balance: balance[0] ?? null, invoices: invoices.rows, payments: payments.rows };
  }

  /** Skills that apply to the student's licence class, with their current level. */
  async skills(studentId: string, db: Queryable = this.db) {
    const { rows } = await db.query(
      `SELECT k.id, k.name, k.category, coalesce(ss.level, 'not_started') AS level, ss.updated_at
       FROM skills k
       CROSS JOIN students s
       LEFT JOIN courses c ON c.id = s.course_id
       LEFT JOIN student_skills ss ON ss.skill_id = k.id AND ss.student_id = s.id
       WHERE s.id = $1 AND k.deleted_at IS NULL AND k.active
         AND (cardinality(k.licence_classes) = 0 OR c.licence_class = ANY(k.licence_classes))
       ORDER BY k.position`,
      [studentId],
    );
    return rows;
  }

  async setSkill(studentId: string, skillId: string, level: string, user: CurrentUser) {
    if (!user.permissions.has("students.notes") && !user.permissions.has("students.manage"))
      throw forbidden();
    if (!SKILL_LEVELS.includes(level as SkillLevel)) throw badRequest("Unknown skill level");
    await this.repository.get(this.def, studentId, user);

    await inTransaction(this.db, async (client) => {
      const { rows: skill } = await client.query(
        "SELECT name FROM skills WHERE id = $1 AND deleted_at IS NULL",
        [skillId],
      );
      if (!skill[0]) throw notFound("Skill");
      const { rows: previous } = await client.query(
        "SELECT level FROM student_skills WHERE student_id = $1 AND skill_id = $2",
        [studentId, skillId],
      );
      await client.query(
        `INSERT INTO student_skills (student_id, skill_id, level, updated_by) VALUES ($1, $2, $3, $4)
         ON CONFLICT (student_id, skill_id) DO UPDATE SET level = excluded.level,
           updated_by = excluded.updated_by, updated_at = now()`,
        [studentId, skillId, level, user.id],
      );
      await recordActivity(client, toActor(user), {
        action: "update",
        resource: "student_skills",
        recordId: `${studentId}:${skillId}`,
        summary: `Set “${skill[0].name}” to ${level.replace("_", " ")}`,
        before: { level: previous[0]?.level ?? "not_started" },
        after: { level },
      });
    });
  }

  /** Test readiness from skills, completed lessons, mock exams, documents and balance. */
  async readiness(db: Queryable, studentId: string): Promise<Readiness> {
    const settings = (await loadSettings(db)).theory;
    const skillTarget = Number(settings.readiness_skill_percent ?? 100);
    const mockTarget = Number(settings.readiness_mock_passes ?? 0);

    const [skills, lessons, mocks, docs, balance] = await Promise.all([
      this.skills(studentId, db),
      db.query<{ done: number; required: number | null }>(
        `SELECT (SELECT count(*) FROM bookings WHERE student_id = s.id AND status = 'completed' AND deleted_at IS NULL) AS done,
                c.lessons AS required
         FROM students s LEFT JOIN courses c ON c.id = s.course_id WHERE s.id = $1`,
        [studentId],
      ),
      db.query<{ passes: number }>(
        `SELECT count(*) AS passes FROM theory_attempts a JOIN theory_tests t ON t.id = a.test_id
         WHERE a.student_id = $1 AND a.passed AND t.kind = 'mock_exam'`,
        [studentId],
      ),
      db.query<{ missing: string[] }>(
        `SELECT coalesce(array_agg(kind) FILTER (WHERE NOT verified_exists), '{}') AS missing FROM (
           SELECT required.kind, EXISTS (
             SELECT 1 FROM student_documents d WHERE d.student_id = s.id AND d.kind = required.kind
               AND d.verified AND d.deleted_at IS NULL AND (d.expires_on IS NULL OR d.expires_on >= current_date)
           ) AS verified_exists
           FROM students s JOIN courses c ON c.id = s.course_id
           CROSS JOIN LATERAL unnest(c.documents_required) AS required(kind)
           WHERE s.id = $1
         ) checks`,
        [studentId],
      ),
      balances(db, studentId),
    ]);

    const competent = skills.filter((skill) => skill.level === "competent").length;
    const skillPercent = skills.length ? Math.round((competent / skills.length) * 100) : 100;
    const lessonRow = lessons.rows[0];
    const lessonsDone = lessonRow?.done ?? 0;
    const lessonsRequired = lessonRow?.required ?? 0;
    const mockPasses = mocks.rows[0]?.passes ?? 0;
    const missingDocs = docs.rows[0]?.missing ?? [];
    const owed = balance[0]?.balance ?? 0;

    const checks: ReadinessCheck[] = [
      {
        label: "Skills checklist",
        done: skillPercent >= skillTarget,
        detail: `${competent} of ${skills.length} competent`,
      },
      {
        label: "Practical lessons",
        done: lessonsDone >= lessonsRequired,
        detail: lessonsRequired
          ? `${lessonsDone} of ${lessonsRequired} completed`
          : `${lessonsDone} completed`,
      },
      {
        label: "Mock exams passed",
        done: mockPasses >= mockTarget,
        detail: `${mockPasses} of ${mockTarget}`,
      },
      {
        label: "Documents checked",
        done: missingDocs.length === 0,
        detail: missingDocs.length
          ? `Missing: ${missingDocs.map(documentLabel).join(", ")}`
          : "All checked",
      },
      {
        label: "Fees paid",
        done: owed <= 0,
        detail: owed > 0 ? `${owed.toLocaleString("en-GB")} outstanding` : "Paid",
      },
    ];
    return { ready: checks.every((check) => check.done), checks };
  }

  /** Creates or updates the student's portal login. */
  async setPortalAccess(studentId: string, input: unknown, user: CurrentUser) {
    if (!user.permissions.has("students.manage")) throw forbidden();
    const fields: Field[] = [
      { name: "email", label: "Email", type: "email", required: true },
      { name: "password", label: "Password", type: "password" },
      { name: "active", label: "Active", type: "boolean" },
    ];
    const result = validate(fields, input, "create");
    if (!result.ok) throw badRequest("Please correct the highlighted fields", result.errors);
    const { email, password, active } = result.data as {
      email: string;
      password?: string;
      active: boolean;
    };

    await inTransaction(this.db, async (client) => {
      const student = await this.repository.get(this.def, studentId, user, client);
      try {
        if (student.user_id) {
          await client.query(
            `UPDATE users SET email = $2, active = $3, updated_at = now(),
               password_hash = coalesce($4, password_hash) WHERE id = $1`,
            [student.user_id, email, active, password ? await hashPassword(password) : null],
          );
          if (!active || password) await destroyUserSessions(this.db, String(student.user_id));
        } else {
          if (!password)
            throw badRequest("Set a password", { password: "Required for a new login" });
          const { rows } = await client.query<{ id: string }>(
            `INSERT INTO users (name, email, phone, password_hash, role, active)
             VALUES ($1, $2, $3, $4, 'student', $5) RETURNING id`,
            [student.full_name, email, student.phone, await hashPassword(password), active],
          );
          await client.query("UPDATE students SET user_id = $2 WHERE id = $1", [
            studentId,
            rows[0]!.id,
          ]);
        }
      } catch (error) {
        if (pgCode(error) === PG.uniqueViolation)
          throw conflict("That email is already used by another login", {
            email: "Already in use",
          });
        throw error;
      }
      await recordActivity(client, toActor(user), {
        action: "update",
        resource: "portal_access",
        recordId: studentId,
        summary: `${active ? "Enabled" : "Disabled"} portal login for “${student.full_name}”`,
      });
    });
  }
}
