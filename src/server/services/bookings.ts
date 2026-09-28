import type { Db, Queryable } from "../db/pool.js";
import { inTransaction } from "../db/pool.js";
import { badRequest, conflict, forbidden, notFound } from "../errors.js";
import { getResource } from "../../shared/resources.js";
import type { CurrentUser } from "./auth.js";
import type { ResourceHooks, Row } from "./repository.js";
import { Repository, toActor } from "./repository.js";
import { loadSettings } from "./settings.js";
import { addDays, localParts, minutesToTime, timeToMinutes, todayIn, zonedToUtc } from "./time.js";

export interface BookingRules {
  timezone: string;
  self_booking_enabled: boolean;
  require_confirmation: boolean;
  lesson_minutes: number;
  max_lessons_per_day: number;
  min_notice_hours: number;
  booking_horizon_days: number;
  cancellation_hours: number;
  opening_time: string;
  closing_time: string;
  working_days: string[];
}

export async function loadBookingRules(db: Queryable): Promise<BookingRules> {
  return (await loadSettings(db)).booking as unknown as BookingRules;
}

const ACTIVE = ["requested", "confirmed"];

interface Interval {
  start: number;
  end: number;
}

const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;

/** Checks that a lesson can go ahead with this instructor and vehicle; used by staff and students. */
async function assertResourcesUsable(
  db: Queryable,
  booking: Record<string, unknown>,
  lessonDate: string,
) {
  const { rows: instructors } = await db.query(
    "SELECT active, licence_classes FROM instructors WHERE id = $1 AND deleted_at IS NULL",
    [booking.instructor_id],
  );
  const instructor = instructors[0];
  if (!instructor)
    throw badRequest("Choose an instructor", { instructor_id: "Instructor not found" });
  if (!instructor.active)
    throw badRequest("That instructor is not active", { instructor_id: "Not active" });

  const licenceClass = await studentLicenceClass(db, String(booking.student_id));
  if (
    licenceClass &&
    instructor.licence_classes.length &&
    !instructor.licence_classes.includes(licenceClass)
  ) {
    throw badRequest(`That instructor does not teach class ${licenceClass}`, {
      instructor_id: `Does not teach class ${licenceClass}`,
    });
  }

  if (!booking.vehicle_id) return;
  const { rows: vehicles } = await db.query(
    `SELECT active, licence_classes, insurance_expires_on, fitness_expires_on
     FROM vehicles WHERE id = $1 AND deleted_at IS NULL`,
    [booking.vehicle_id],
  );
  const vehicle = vehicles[0];
  if (!vehicle) throw badRequest("Vehicle not found", { vehicle_id: "Vehicle not found" });
  if (!vehicle.active)
    throw badRequest("That vehicle is out of service", { vehicle_id: "Out of service" });
  if (vehicle.insurance_expires_on && vehicle.insurance_expires_on < lessonDate) {
    throw badRequest("That vehicle's insurance expires before the lesson", {
      vehicle_id: "Insurance expired",
    });
  }
  if (vehicle.fitness_expires_on && vehicle.fitness_expires_on < lessonDate) {
    throw badRequest("That vehicle's certificate of fitness expires before the lesson", {
      vehicle_id: "Certificate of fitness expired",
    });
  }
  if (
    licenceClass &&
    vehicle.licence_classes.length &&
    !vehicle.licence_classes.includes(licenceClass)
  ) {
    throw badRequest(`That vehicle is not used for class ${licenceClass}`, {
      vehicle_id: `Not used for class ${licenceClass}`,
    });
  }
}

async function studentLicenceClass(db: Queryable, studentId: string): Promise<string | null> {
  const { rows } = await db.query<{ licence_class: string | null }>(
    `SELECT c.licence_class FROM students s LEFT JOIN courses c ON c.id = s.course_id WHERE s.id = $1`,
    [studentId],
  );
  return rows[0]?.licence_class ?? null;
}

export const bookingHooks: ResourceHooks = {
  extraColumns: ["ends_at", "booked_by"],
  async prepare(data, { db, user, existing }) {
    const rules = await loadBookingRules(db);
    const merged = { ...existing, ...data };
    const duration = Number(merged.duration_minutes ?? rules.lesson_minutes);
    const startsAt = new Date(String(merged.starts_at));
    const result: Record<string, unknown> = {
      ...data,
      duration_minutes: duration,
      ends_at: new Date(startsAt.getTime() + duration * 60_000).toISOString(),
    };
    if (!existing) result.booked_by = user?.id ?? null;

    const becomesActive = ACTIVE.includes(String(merged.status ?? "confirmed"));
    if (becomesActive) {
      await assertResourcesUsable(db, merged, localParts(startsAt, rules.timezone).date);
    }
    return result;
  },
};

export interface Slot {
  starts_at: string;
  time: string;
}

interface SlotContext {
  rules: BookingRules;
  availability: { day: string; start: string; end: string }[];
  busy: Interval[];
  studentBusy: Interval[];
  vehicleIds: string[];
  vehicleBusy: Map<string, Interval[]>;
}

/**
 * Free lesson start times for a student with an instructor on one local date,
 * applying the school's booking rules.
 */
export async function availableSlots(
  db: Queryable,
  studentId: string,
  instructorId: string,
  date: string,
  now = new Date(),
): Promise<Slot[]> {
  const rules = await loadBookingRules(db);
  const context = await slotContext(db, rules, studentId, instructorId, date);
  if (!context) return [];

  const dayOfWeek = new Date(`${date}T00:00:00Z`).getUTCDay();
  if (!rules.working_days.includes(String(dayOfWeek))) return [];
  const earliest = now.getTime() + rules.min_notice_hours * 3_600_000;
  const latestDate = addDays(todayIn(rules.timezone, now), rules.booking_horizon_days);
  if (date > latestDate) return [];

  const lessonsThatDay = context.studentBusy.length;
  if (lessonsThatDay >= rules.max_lessons_per_day) return [];

  const windows = context.availability.filter((window) => window.day === String(dayOfWeek));
  const open = timeToMinutes(rules.opening_time);
  const close = timeToMinutes(rules.closing_time);
  const length = rules.lesson_minutes;
  const slots: Slot[] = [];

  for (let minute = open; minute + length <= close; minute += length) {
    const inWindow = windows.some(
      (window) =>
        timeToMinutes(window.start) <= minute && minute + length <= timeToMinutes(window.end),
    );
    if (!inWindow) continue;
    const start = zonedToUtc(date, minutesToTime(minute), rules.timezone).getTime();
    const slot = { start, end: start + length * 60_000 };
    if (start < earliest) continue;
    if (
      context.busy.some((b) => overlaps(b, slot)) ||
      context.studentBusy.some((b) => overlaps(b, slot))
    )
      continue;
    if (!freeVehicle(context, slot)) continue;
    slots.push({ starts_at: new Date(start).toISOString(), time: minutesToTime(minute) });
  }
  return slots;
}

async function slotContext(
  db: Queryable,
  rules: BookingRules,
  studentId: string,
  instructorId: string,
  date: string,
): Promise<SlotContext | null> {
  const { rows: instructors } = await db.query(
    "SELECT availability FROM instructors WHERE id = $1 AND active AND deleted_at IS NULL",
    [instructorId],
  );
  if (!instructors[0]) return null;

  const dayStart = zonedToUtc(date, "00:00", rules.timezone);
  const dayEnd = zonedToUtc(addDays(date, 1), "00:00", rules.timezone);
  const { rows: bookings } = await db.query<{
    instructor_id: string;
    student_id: string;
    vehicle_id: string | null;
    starts_at: Date;
    ends_at: Date;
  }>(
    `SELECT instructor_id, student_id, vehicle_id, starts_at, ends_at FROM bookings
     WHERE deleted_at IS NULL AND status = ANY($1) AND starts_at < $3 AND ends_at > $2`,
    [ACTIVE, dayStart, dayEnd],
  );
  const interval = (b: { starts_at: Date; ends_at: Date }) => ({
    start: b.starts_at.getTime(),
    end: b.ends_at.getTime(),
  });

  const vehicleIds = await suitableVehicles(db, studentId, date);
  const vehicleBusy = new Map<string, Interval[]>(vehicleIds.map((id) => [id, []]));
  for (const booking of bookings) {
    if (booking.vehicle_id) vehicleBusy.get(booking.vehicle_id)?.push(interval(booking));
  }

  return {
    rules,
    availability: instructors[0].availability ?? [],
    busy: bookings.filter((b) => b.instructor_id === instructorId).map(interval),
    studentBusy: bookings.filter((b) => b.student_id === studentId).map(interval),
    vehicleIds,
    vehicleBusy,
  };
}

function freeVehicle(context: SlotContext, slot: Interval): string | null {
  return (
    context.vehicleIds.find((id) => !context.vehicleBusy.get(id)!.some((b) => overlaps(b, slot))) ??
    null
  );
}

/** Active, roadworthy vehicles that suit the student's course, preferring their branch. */
async function suitableVehicles(db: Queryable, studentId: string, date: string): Promise<string[]> {
  const { rows } = await db.query<{ id: string }>(
    `SELECT v.id FROM vehicles v
     JOIN students s ON s.id = $1
     LEFT JOIN courses c ON c.id = s.course_id
     WHERE v.deleted_at IS NULL AND v.active
       AND (v.insurance_expires_on IS NULL OR v.insurance_expires_on >= $2)
       AND (v.fitness_expires_on IS NULL OR v.fitness_expires_on >= $2)
       AND (c.licence_class IS NULL OR cardinality(v.licence_classes) = 0 OR c.licence_class = ANY(v.licence_classes))
       AND (c.gearbox IS NULL OR c.gearbox NOT IN ('manual', 'automatic') OR v.gearbox = c.gearbox)
     ORDER BY (v.branch_id IS NOT DISTINCT FROM s.branch_id) DESC, v.plate`,
    [studentId, date],
  );
  return rows.map((row) => row.id);
}

export class BookingService {
  private readonly repository: Repository;

  constructor(
    private readonly db: Db,
    repository: Repository,
  ) {
    this.repository = repository;
  }

  private get def() {
    return getResource("bookings")!;
  }

  /** A student booking a lesson from the portal. The chosen slot is re-checked inside the transaction. */
  async selfBook(
    user: CurrentUser,
    input: { instructor_id?: string; starts_at?: string },
    now = new Date(),
  ) {
    const studentId = requireStudent(user);
    const rules = await loadBookingRules(this.db);
    if (!rules.self_booking_enabled)
      throw forbidden("Online booking is switched off. Please contact the office.");
    const instructorId = input.instructor_id ?? (await this.assignedInstructor(studentId));
    if (!instructorId || !input.starts_at) throw badRequest("Choose an instructor and a time");

    const startsAt = new Date(input.starts_at);
    if (Number.isNaN(startsAt.getTime())) throw badRequest("Choose a valid time");
    const date = localParts(startsAt, rules.timezone).date;

    return inTransaction(this.db, async (client) => {
      // Serialise self-bookings per student so the daily limit cannot be exceeded by parallel requests.
      await client.query("SELECT 1 FROM students WHERE id = $1 FOR UPDATE", [studentId]);
      const slots = await availableSlots(client, studentId, instructorId, date, now);
      if (!slots.some((slot) => slot.starts_at === startsAt.toISOString())) {
        throw conflict("That time is no longer available. Please choose another.");
      }
      const context = await slotContext(client, rules, studentId, instructorId, date);
      const start = startsAt.getTime();
      const vehicleId =
        context && freeVehicle(context, { start, end: start + rules.lesson_minutes * 60_000 });
      const branchId = await this.studentBranch(client, studentId);

      return this.repository.createWith(
        client,
        this.def,
        {
          student_id: studentId,
          instructor_id: instructorId,
          vehicle_id: vehicleId,
          branch_id: branchId,
          kind: "practical",
          starts_at: startsAt.toISOString(),
          duration_minutes: rules.lesson_minutes,
          status: rules.require_confirmation ? "requested" : "confirmed",
        },
        null,
        { booked_by: user.id },
        toActor(user),
      );
    });
  }

  async selfCancel(user: CurrentUser, bookingId: string, now = new Date()) {
    const studentId = requireStudent(user);
    const rules = await loadBookingRules(this.db);
    const booking = await this.studentBooking(studentId, bookingId);
    assertChangeable(booking, rules, now);
    return inTransaction(this.db, (client) =>
      this.repository.updateWith(
        client,
        this.def,
        bookingId,
        { status: "cancelled" },
        null,
        toActor(user),
      ),
    );
  }

  async selfReschedule(user: CurrentUser, bookingId: string, startsAt: string, now = new Date()) {
    const studentId = requireStudent(user);
    const rules = await loadBookingRules(this.db);
    const booking = await this.studentBooking(studentId, bookingId);
    assertChangeable(booking, rules, now);
    // Cancel first so the student's own lesson does not block the new slot, then book;
    // if booking fails the whole change is rolled back.
    return inTransaction(this.db, async (client) => {
      await this.repository.updateWith(
        client,
        this.def,
        bookingId,
        { status: "cancelled" },
        null,
        toActor(user),
      );
      const date = localParts(new Date(startsAt), rules.timezone).date;
      const slots = await availableSlots(
        client,
        studentId,
        String(booking.instructor_id),
        date,
        now,
      );
      const target = new Date(startsAt).toISOString();
      if (!slots.some((slot) => slot.starts_at === target)) {
        throw conflict("That time is no longer available. Please choose another.");
      }
      return this.repository.createWith(
        client,
        this.def,
        {
          student_id: studentId,
          instructor_id: booking.instructor_id,
          vehicle_id: booking.vehicle_id,
          branch_id: booking.branch_id,
          kind: booking.kind,
          starts_at: target,
          duration_minutes: booking.duration_minutes,
          status: rules.require_confirmation ? "requested" : "confirmed",
        },
        null,
        { booked_by: user.id },
        toActor(user),
      );
    });
  }

  /** Instructors record how their own lesson went without being able to move or reassign it. */
  async recordOutcome(
    user: CurrentUser,
    bookingId: string,
    input: { status?: string; lesson_notes?: string },
  ) {
    const booking = await this.repository.get(this.def, bookingId, user);
    const own = user.instructorId && booking.instructor_id === user.instructorId;
    if (!own && !user.permissions.has("bookings.manage")) throw forbidden();
    const status =
      input.status && ["completed", "no_show", "confirmed"].includes(input.status)
        ? input.status
        : undefined;
    return inTransaction(this.db, (client) =>
      this.repository.updateWith(
        client,
        this.def,
        bookingId,
        { status, lesson_notes: input.lesson_notes },
        null,
        toActor(user),
      ),
    );
  }

  async calendar(
    user: CurrentUser,
    query: { from: string; to: string; instructor_id?: string; vehicle_id?: string },
  ) {
    this.repository.assertCanView(this.def, user);
    const params: unknown[] = [query.from, query.to];
    const where = ["b.deleted_at IS NULL", "b.starts_at < $2", "b.ends_at > $1"];
    if (!user.permissions.has("bookings.view") && !user.permissions.has("bookings.manage")) {
      params.push(user.instructorId);
      where.push(`b.instructor_id = $${params.length}`);
    }
    if (query.instructor_id) {
      params.push(query.instructor_id);
      where.push(`b.instructor_id = $${params.length}`);
    }
    if (query.vehicle_id) {
      params.push(query.vehicle_id);
      where.push(`b.vehicle_id = $${params.length}`);
    }
    const { rows } = await this.db.query(
      `SELECT b.*, s.full_name AS student_name, s.phone AS student_phone, i.name AS instructor_name,
              v.plate AS vehicle_plate
       FROM bookings b
       JOIN students s ON s.id = b.student_id
       JOIN instructors i ON i.id = b.instructor_id
       LEFT JOIN vehicles v ON v.id = b.vehicle_id
       WHERE ${where.join(" AND ")}
       ORDER BY b.starts_at`,
      params,
    );
    return rows;
  }

  async studentLessons(user: CurrentUser) {
    const studentId = requireStudent(user);
    const { rows } = await this.db.query(
      `SELECT b.id, b.starts_at, b.ends_at, b.status, b.kind, b.lesson_notes, b.instructor_id,
              i.name AS instructor_name, v.plate AS vehicle_plate, v.make AS vehicle_make, v.model AS vehicle_model
       FROM bookings b
       JOIN instructors i ON i.id = b.instructor_id
       LEFT JOIN vehicles v ON v.id = b.vehicle_id
       WHERE b.student_id = $1 AND b.deleted_at IS NULL
       ORDER BY b.starts_at DESC LIMIT 200`,
      [studentId],
    );
    return rows;
  }

  private async assignedInstructor(studentId: string): Promise<string | null> {
    const { rows } = await this.db.query("SELECT instructor_id FROM students WHERE id = $1", [
      studentId,
    ]);
    return rows[0]?.instructor_id ?? null;
  }

  private async studentBranch(db: Queryable, studentId: string): Promise<string | null> {
    const { rows } = await db.query("SELECT branch_id FROM students WHERE id = $1", [studentId]);
    return rows[0]?.branch_id ?? null;
  }

  private async studentBooking(studentId: string, bookingId: string): Promise<Row> {
    const { rows } = await this.db.query<Row>(
      "SELECT * FROM bookings WHERE id = $1 AND student_id = $2 AND deleted_at IS NULL",
      [bookingId, studentId],
    );
    if (!rows[0]) throw notFound("Lesson");
    return rows[0];
  }
}

function requireStudent(user: CurrentUser): string {
  if (!user.studentId) throw forbidden("Only students can do this");
  return user.studentId;
}

function assertChangeable(booking: Row, rules: BookingRules, now: Date) {
  if (!ACTIVE.includes(String(booking.status)))
    throw badRequest("This lesson can no longer be changed");
  const hoursLeft = ((booking.starts_at as Date).getTime() - now.getTime()) / 3_600_000;
  if (hoursLeft < rules.cancellation_hours) {
    throw forbidden(
      `Lessons can only be changed up to ${rules.cancellation_hours} hours before they start. Please call the office.`,
    );
  }
}
