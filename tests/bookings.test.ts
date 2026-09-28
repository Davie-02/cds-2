import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { availableSlots } from "../src/server/services/bookings.js";
import { loadUser, type CurrentUser } from "../src/server/services/auth.js";
import { OWNER, client, login, setup, teardown, type Client, type TestContext } from "./helpers.js";

// 2030-01-08 is a Tuesday; the school's default time zone (Africa/Blantyre) is UTC+2.
const DAY = "2030-01-08";
const at = (localTime: string, day = DAY) => new Date(`${day}T${localTime}:00+02:00`).toISOString();

describe("bookings", () => {
  let ctx: TestContext;
  let office: Client;
  let instructors: string[];
  let vehicles: string[];
  let students: string[];

  const book = (
    student: number,
    instructor: number,
    vehicle: number | null,
    time: string,
    extra: object = {},
  ) =>
    office.post("/api/admin/r/bookings", {
      student_id: students[student],
      instructor_id: instructors[instructor],
      vehicle_id: vehicle === null ? null : vehicles[vehicle],
      starts_at: at(time),
      duration_minutes: 30,
      status: "confirmed",
      ...extra,
    });

  beforeAll(async () => {
    ctx = await setup();
    office = client(ctx.app, await login(ctx.app, OWNER.email, OWNER.password));
    const courses = await office.get("/api/admin/r/courses?q=Code B");
    const courseId = courses.body.items[0].id;
    const people = await office.get("/api/admin/r/instructors");
    instructors = people.body.items.slice(0, 2).map((row: { id: string }) => row.id);
    vehicles = [];
    for (const plate of ["MZ 1111", "MZ 2222", "MZ 3333"]) {
      const created = await office.post("/api/admin/r/vehicles", {
        plate,
        make: "Toyota",
        model: "Vitz",
        gearbox: "manual",
        licence_classes: ["B"],
      });
      vehicles.push(created.body.id);
    }
    students = [];
    for (const name of ["Alinafe", "Blessings", "Chikondi"]) {
      const created = await office.post("/api/admin/r/students", {
        full_name: name,
        phone: "0999111222",
        course_id: courseId,
        instructor_id: instructors[0],
      });
      students.push(created.body.id);
    }
  });
  afterAll(() => teardown(ctx));

  describe("conflicts", () => {
    it("accepts a free slot and works out the end time", async () => {
      const response = await book(0, 0, 0, "09:00");
      expect(response.status).toBe(201);
      expect(response.body.ends_at).toBe(at("09:30").replace(".000Z", ".000Z"));
    });

    it("refuses a second lesson for the same instructor", async () => {
      const response = await book(1, 0, 1, "09:15");
      expect(response.status).toBe(409);
      expect(response.body.error).toMatch(/instructor/);
    });

    it("refuses the same vehicle twice", async () => {
      const response = await book(1, 1, 0, "09:00");
      expect(response.status).toBe(409);
      expect(response.body.error).toMatch(/vehicle/);
    });

    it("refuses two lessons at once for one student", async () => {
      const response = await book(0, 1, 1, "09:10");
      expect(response.status).toBe(409);
      expect(response.body.error).toMatch(/student/);
    });

    it("allows back-to-back lessons", async () => {
      expect((await book(1, 0, 0, "09:30")).status).toBe(201);
    });

    it("frees the slot when a lesson is cancelled", async () => {
      const first = await book(2, 1, 2, "11:00");
      expect((await book(1, 1, 1, "11:00")).status).toBe(409);
      await office.patch(`/api/admin/r/bookings/${first.body.id}`, { status: "cancelled" });
      expect((await book(1, 1, 1, "11:00")).status).toBe(201);
    });

    it("refuses a clash when rescheduling onto a taken slot", async () => {
      const lesson = await book(2, 0, 2, "13:00");
      const clash = await office.patch(`/api/admin/r/bookings/${lesson.body.id}`, {
        starts_at: at("09:00"),
      });
      expect(clash.status).toBe(409);
    });

    it("lets only one of two simultaneous requests win", async () => {
      const results = await Promise.all([
        book(0, 0, 0, "15:00"),
        book(1, 0, 1, "15:00"),
        book(2, 0, 2, "15:00"),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409]);
    });

    it("refuses vehicles whose insurance has run out", async () => {
      await office.patch(`/api/admin/r/vehicles/${vehicles[2]}`, {
        insurance_expires_on: "2029-12-31",
      });
      const response = await book(2, 1, 2, "16:00");
      expect(response.status).toBe(400);
      expect(response.body.fields.vehicle_id).toMatch(/Insurance/);
      await office.patch(`/api/admin/r/vehicles/${vehicles[2]}`, { insurance_expires_on: null });
    });
  });

  describe("student self-booking", () => {
    let student: CurrentUser;
    const NOW = new Date(at("08:00", "2030-01-14"));
    const TOMORROW = "2030-01-15";

    beforeAll(async () => {
      await office.put(`/api/admin/students/${students[2]}/portal-access`, {
        email: "learner@test.local",
        password: "learner-pass-1",
        active: true,
      });
      const { rows } = await ctx.db.query("SELECT user_id FROM students WHERE id = $1", [
        students[2],
      ]);
      student = (await loadUser(ctx.db, rows[0].user_id))!;
    });

    it("offers slots within opening hours and after the notice period", async () => {
      const today = await availableSlots(ctx.db, students[2]!, instructors[0]!, "2030-01-14", NOW);
      expect(
        today.every((slot) => new Date(slot.starts_at).getTime() >= NOW.getTime() + 12 * 3_600_000),
      ).toBe(true);
      const tomorrow = await availableSlots(ctx.db, students[2]!, instructors[0]!, TOMORROW, NOW);
      expect(tomorrow[0]?.time).toBe("07:00");
      expect(tomorrow.at(-1)?.time).toBe("16:30");
    });

    it("offers nothing on non-working days or beyond the booking horizon", async () => {
      expect(
        await availableSlots(ctx.db, students[2]!, instructors[0]!, "2030-01-20", NOW),
      ).toEqual([]);
      expect(
        await availableSlots(ctx.db, students[2]!, instructors[0]!, "2030-03-01", NOW),
      ).toEqual([]);
    });

    it("books a free slot, assigns a vehicle and waits for confirmation", async () => {
      const lesson = await ctx.services.bookings.selfBook(
        student,
        { instructor_id: instructors[0], starts_at: at("07:00", TOMORROW) },
        NOW,
      );
      expect(lesson.status).toBe("requested");
      expect(lesson.vehicle_id).toBeTruthy();
      const slots = await availableSlots(ctx.db, students[2]!, instructors[0]!, TOMORROW, NOW);
      expect(slots.some((slot) => slot.time === "07:00")).toBe(false);
    });

    it("enforces the daily lesson limit", async () => {
      await ctx.services.bookings.selfBook(
        student,
        { instructor_id: instructors[0], starts_at: at("10:00", TOMORROW) },
        NOW,
      );
      await expect(
        ctx.services.bookings.selfBook(
          student,
          { instructor_id: instructors[0], starts_at: at("12:00", TOMORROW) },
          NOW,
        ),
      ).rejects.toMatchObject({ status: 409 });
    });

    it("refuses a slot that is not on offer", async () => {
      await expect(
        ctx.services.bookings.selfBook(
          student,
          { instructor_id: instructors[0], starts_at: at("06:00", "2030-01-16") },
          NOW,
        ),
      ).rejects.toMatchObject({ status: 409 });
    });

    it("only allows cancelling outside the cancellation window", async () => {
      const lesson = await ctx.services.bookings.selfBook(
        student,
        { instructor_id: instructors[0], starts_at: at("09:00", "2030-01-17") },
        NOW,
      );
      const tooLate = new Date(new Date(lesson.starts_at as string).getTime() - 2 * 3_600_000);
      await expect(
        ctx.services.bookings.selfCancel(student, lesson.id, tooLate),
      ).rejects.toMatchObject({ status: 403 });
      const cancelled = await ctx.services.bookings.selfCancel(student, lesson.id, NOW);
      expect(cancelled.status).toBe("cancelled");
    });

    it("reschedules atomically", async () => {
      const lesson = await ctx.services.bookings.selfBook(
        student,
        { instructor_id: instructors[0], starts_at: at("09:00", "2030-01-18") },
        NOW,
      );
      const moved = await ctx.services.bookings.selfReschedule(
        student,
        lesson.id,
        at("11:00", "2030-01-18"),
        NOW,
      );
      expect(moved.starts_at).toEqual(new Date(at("11:00", "2030-01-18")));
      await expect(
        ctx.services.bookings.selfReschedule(student, moved.id, at("05:00", "2030-01-18"), NOW),
      ).rejects.toMatchObject({ status: 409 });
      const { rows } = await ctx.db.query("SELECT status FROM bookings WHERE id = $1", [moved.id]);
      expect(rows[0].status).toBe("requested");
    });
  });
});
