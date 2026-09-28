import type { Queryable } from "../db/pool.js";
import type { CurrentUser } from "./auth.js";
import { balances, overdueInstalments } from "./finance.js";
import { loadSettings } from "./settings.js";
import { addDays, todayIn, zonedToUtc } from "./time.js";

export interface Reminder {
  kind: "vehicle" | "permit" | "document";
  subject: string;
  detail: string;
  due_on: string;
  overdue: boolean;
  link: string;
}

const VEHICLE_DATES: [column: string, label: string][] = [
  ["insurance_expires_on", "Insurance expires"],
  ["fitness_expires_on", "Certificate of fitness expires"],
  ["next_service_on", "Service due"],
];

/** Vehicle papers, services and student permits that fall due within the warning window. */
export async function upcomingReminders(db: Queryable, today: string): Promise<Reminder[]> {
  const settings = await loadSettings(db);
  const until = addDays(today, Number(settings.reminders.vehicle_warning_days ?? 30));
  const reminders: Reminder[] = [];

  for (const [column, label] of VEHICLE_DATES) {
    const { rows } = await db.query(
      `SELECT id, plate, make, model, ${column} AS due_on FROM vehicles
       WHERE deleted_at IS NULL AND active AND ${column} IS NOT NULL AND ${column} <= $1`,
      [until],
    );
    for (const row of rows) {
      reminders.push({
        kind: "vehicle",
        subject: `${row.plate} (${row.make} ${row.model})`,
        detail: label,
        due_on: row.due_on,
        overdue: row.due_on < today,
        link: `/r/vehicles/${row.id}`,
      });
    }
  }

  const { rows: permits } = await db.query(
    `SELECT id, full_name, permit_expires_on AS due_on FROM students
     WHERE deleted_at IS NULL AND status IN ('active', 'test_ready') AND permit_expires_on <= $1`,
    [until],
  );
  for (const row of permits) {
    reminders.push({
      kind: "permit",
      subject: row.full_name,
      detail: "Learner's permit expires",
      due_on: row.due_on,
      overdue: row.due_on < today,
      link: `/students/${row.id}`,
    });
  }

  return reminders.sort((a, b) => a.due_on.localeCompare(b.due_on));
}

export async function dashboard(db: Queryable, user: CurrentUser, now = new Date()) {
  const settings = await loadSettings(db);
  const timezone = String(settings.booking.timezone);
  const today = todayIn(timezone, now);
  const dayStart = zonedToUtc(today, "00:00", timezone);
  const dayEnd = zonedToUtc(addDays(today, 1), "00:00", timezone);
  const can = (permission: Parameters<typeof user.permissions.has>[0]) =>
    user.permissions.has(permission);
  const seesAllLessons = can("bookings.view") || can("bookings.manage");

  const lessons =
    seesAllLessons || user.instructorId
      ? (
          await db.query(
            `SELECT b.id, b.starts_at, b.ends_at, b.status, s.full_name AS student_name, i.name AS instructor_name,
                    v.plate AS vehicle_plate
             FROM bookings b JOIN students s ON s.id = b.student_id JOIN instructors i ON i.id = b.instructor_id
             LEFT JOIN vehicles v ON v.id = b.vehicle_id
             WHERE b.deleted_at IS NULL AND b.status IN ('requested', 'confirmed', 'completed')
               AND b.starts_at >= $1 AND b.starts_at < $2 AND ($3::boolean OR b.instructor_id = $4)
             ORDER BY b.starts_at`,
            [dayStart, dayEnd, seesAllLessons, user.instructorId],
          )
        ).rows
      : [];

  const requests = can("bookings.manage")
    ? (
        await db.query(
          `SELECT b.id, b.starts_at, s.full_name AS student_name, i.name AS instructor_name
             FROM bookings b JOIN students s ON s.id = b.student_id JOIN instructors i ON i.id = b.instructor_id
             WHERE b.deleted_at IS NULL AND b.status = 'requested' AND b.starts_at > now() ORDER BY b.starts_at`,
        )
      ).rows
    : [];

  const counts = await db.query<{
    new_enquiries: number;
    active_students: number;
    pending_payments: number;
  }>(
    `SELECT (SELECT count(*) FROM enquiries WHERE status = 'new' AND deleted_at IS NULL) AS new_enquiries,
            (SELECT count(*) FROM students WHERE status IN ('active', 'test_ready') AND deleted_at IS NULL) AS active_students,
            (SELECT count(*) FROM payments WHERE status = 'pending' AND deleted_at IS NULL) AS pending_payments`,
  );

  const finance = can("finance.view")
    ? {
        outstanding: (await balances(db)).reduce((sum, row) => sum + Math.max(row.balance, 0), 0),
        overdue: await overdueInstalments(db, today),
        pending_payments: counts.rows[0]?.pending_payments ?? 0,
      }
    : null;

  return {
    today,
    lessons,
    requests,
    reminders:
      can("vehicles.view") || can("students.view") ? await upcomingReminders(db, today) : [],
    new_enquiries: can("enquiries.manage") ? (counts.rows[0]?.new_enquiries ?? 0) : null,
    active_students: can("students.view") ? (counts.rows[0]?.active_students ?? 0) : null,
    finance,
    pass_rates: can("students.view") || can("tests.manage") ? await passRates(db) : null,
  };
}

/** Official test pass rates over the last 12 months, overall and per instructor. */
export async function passRates(db: Queryable) {
  const { rows } = await db.query(
    `SELECT t.kind,
            CASE WHEN grouping(i.name) = 1 THEN 'All instructors' ELSE coalesce(i.name, 'Unassigned') END AS instructor,
            count(*) FILTER (WHERE t.result = 'passed') AS passed,
            count(*) FILTER (WHERE t.result IN ('passed', 'failed')) AS sat
     FROM official_tests t
     LEFT JOIN students s ON s.id = t.student_id
     LEFT JOIN instructors i ON i.id = coalesce(t.instructor_id, s.instructor_id)
     WHERE t.deleted_at IS NULL AND t.scheduled_at > now() - interval '12 months'
     GROUP BY GROUPING SETS ((t.kind), (t.kind, i.name))
     ORDER BY t.kind, grouping(i.name) DESC, instructor`,
  );
  return rows.map((row) => ({
    kind: row.kind,
    instructor: row.instructor,
    passed: row.passed,
    sat: row.sat,
    rate: row.sat ? Math.round((row.passed / row.sat) * 100) : null,
  }));
}
