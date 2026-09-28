import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import type { Services } from "../app.js";
import { DOCUMENT_KINDS, getResource, PAYMENT_METHODS } from "../../shared/resources.js";
import { validate } from "../../shared/validation.js";
import type { Field } from "../../shared/fields.js";
import { inTransaction } from "../db/pool.js";
import { badRequest, notFound } from "../errors.js";
import type { CurrentUser } from "../services/auth.js";
import { availableSlots, loadBookingRules } from "../services/bookings.js";
import { balances } from "../services/finance.js";
import { toActor } from "../services/repository.js";
import { loadSettings } from "../services/settings.js";
import { printInvoice } from "../site/print.js";
import { isUuid, params, queryString, requireStudent } from "./common.js";

const PROOF_FIELDS: Field[] = [
  { name: "amount", label: "Amount", type: "money", min: 1, required: true },
  { name: "method", label: "Method", type: "select", options: PAYMENT_METHODS, required: true },
  { name: "reference", label: "Transaction reference", type: "text", max: 80 },
  { name: "paid_on", label: "Paid on", type: "date", required: true },
  { name: "invoice_id", label: "Invoice", type: "reference" },
];

const DOCUMENT_FIELDS: Field[] = [
  { name: "kind", label: "Document", type: "select", options: DOCUMENT_KINDS, required: true },
];

/** Reads a multipart form with one file; returns the text fields and the file bytes. */
async function multipartForm(request: FastifyRequest) {
  const fields: Record<string, string> = {};
  let file: { bytes: Buffer; filename: string } | null = null;
  for await (const part of request.parts()) {
    if (part.type === "file") file = { bytes: await part.toBuffer(), filename: part.filename };
    else fields[part.fieldname] = String(part.value);
  }
  return { fields, file };
}

export function portalRoutes(services: Services): FastifyPluginAsync {
  const { db, bookings, students, theory, uploads, repository } = services;

  /** Portal code has already checked ownership; the activity log still names the student. */
  const createAsStudent = (resource: string, user: CurrentUser, data: Record<string, unknown>) =>
    inTransaction(db, (client) =>
      repository.createWith(client, getResource(resource)!, data, null, {}, toActor(user)),
    );

  return async (app) => {
    app.addHook("preHandler", async (request) => {
      requireStudent(request);
    });

    app.get("/overview", async (request) => {
      const user = requireStudent(request);
      const [{ rows }, readiness, balance, rules, settings] = await Promise.all([
        db.query(
          `SELECT s.full_name, s.phone, s.email, s.status, s.instructor_id, c.name AS course_name,
                  c.licence_class, i.name AS instructor_name
           FROM students s LEFT JOIN courses c ON c.id = s.course_id LEFT JOIN instructors i ON i.id = s.instructor_id
           WHERE s.id = $1`,
          [user.studentId],
        ),
        students.readiness(db, user.studentId),
        balances(db, user.studentId),
        loadBookingRules(db),
        loadSettings(db),
      ]);
      return {
        student: rows[0],
        readiness,
        balance: balance[0] ?? null,
        currency: settings.payments.currency,
        rules: {
          self_booking_enabled: rules.self_booking_enabled,
          cancellation_hours: rules.cancellation_hours,
          max_lessons_per_day: rules.max_lessons_per_day,
          booking_horizon_days: rules.booking_horizon_days,
          timezone: rules.timezone,
        },
        contact: {
          phone: settings.contact.phone,
          whatsapp_number: settings.contact.whatsapp_number,
        },
      };
    });

    app.get("/instructors", async (request) => {
      const user = requireStudent(request);
      const { rows } = await db.query(
        `SELECT i.id, i.name, i.languages FROM instructors i
         JOIN students s ON s.id = $1
         LEFT JOIN courses c ON c.id = s.course_id
         WHERE i.deleted_at IS NULL AND i.active
           AND (c.licence_class IS NULL OR cardinality(i.licence_classes) = 0 OR c.licence_class = ANY(i.licence_classes))
         ORDER BY (i.id = s.instructor_id) DESC, i.position`,
        [user.studentId],
      );
      return rows;
    });

    app.get("/lessons", async (request) => bookings.studentLessons(requireStudent(request)));

    app.get("/slots", async (request) => {
      const user = requireStudent(request);
      const instructorId = queryString(request, "instructor_id");
      const date = queryString(request, "date");
      if (!isUuid(instructorId) || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date))
        throw badRequest("Choose a date");
      return availableSlots(db, user.studentId, instructorId, date);
    });

    app.post("/lessons", async (request, reply) => {
      const body = (request.body ?? {}) as { instructor_id?: string; starts_at?: string };
      if (body.instructor_id !== undefined && !isUuid(body.instructor_id))
        throw badRequest("Choose an instructor");
      return reply.code(201).send(await bookings.selfBook(requireStudent(request), body));
    });

    app.post("/lessons/:id/cancel", async (request) =>
      bookings.selfCancel(requireStudent(request), params(request).id!),
    );

    app.post("/lessons/:id/reschedule", async (request) => {
      const startsAt = (request.body as { starts_at?: string })?.starts_at;
      if (!startsAt || Number.isNaN(Date.parse(startsAt))) throw badRequest("Choose a new time");
      return bookings.selfReschedule(requireStudent(request), params(request).id!, startsAt);
    });

    app.get("/theory/tests", async (request) =>
      theory.availableTests(requireStudent(request).studentId),
    );
    app.get("/theory/history", async (request) =>
      theory.history(requireStudent(request).studentId),
    );

    app.post("/theory/attempts", async (request, reply) => {
      const testId = (request.body as { test_id?: string })?.test_id;
      if (!isUuid(testId)) throw badRequest("Choose a test");
      return reply.code(201).send(await theory.start(requireStudent(request).studentId, testId));
    });

    app.get("/theory/attempts/:id", async (request) =>
      theory.get(requireStudent(request).studentId, params(request).id!),
    );

    app.post("/theory/attempts/:id/submit", async (request) => {
      const answers = (request.body as { answers?: unknown })?.answers;
      if (typeof answers !== "object" || answers === null) throw badRequest("No answers were sent");
      return theory.submit(
        requireStudent(request).studentId,
        params(request).id!,
        answers as Record<string, unknown>,
      );
    });

    app.get("/finance", async (request) => {
      const user = requireStudent(request);
      const [invoices, payments, balance, settings] = await Promise.all([
        db.query(
          "SELECT id, number, issued_on, due_on, total, instalments FROM invoices WHERE student_id = $1 AND deleted_at IS NULL ORDER BY issued_on DESC",
          [user.studentId],
        ),
        db.query(
          "SELECT id, amount, method, reference, paid_on, status, receipt_number FROM payments WHERE student_id = $1 AND deleted_at IS NULL ORDER BY paid_on DESC",
          [user.studentId],
        ),
        balances(db, user.studentId),
        loadSettings(db),
      ]);
      const {
        currency,
        bank_name,
        bank_account_name,
        bank_account_number,
        bank_branch,
        mobile_money,
      } = settings.payments;
      return {
        invoices: invoices.rows,
        payments: payments.rows,
        balance: balance[0] ?? null,
        payment_details: {
          currency,
          bank_name,
          bank_account_name,
          bank_account_number,
          bank_branch,
          mobile_money,
        },
      };
    });

    app.get("/invoices/:id/print", async (request, reply) => {
      const user = requireStudent(request);
      const { rows } = await db.query(
        "SELECT * FROM invoices WHERE id = $1 AND student_id = $2 AND deleted_at IS NULL",
        [params(request).id, user.studentId],
      );
      if (!rows[0]) throw notFound("Invoice");
      return reply.type("text/html").send(await printInvoice(db, rows[0]));
    });

    app.post("/payments", async (request, reply) => {
      const user = requireStudent(request);
      const { fields, file } = await multipartForm(request);
      const result = validate(PROOF_FIELDS, fields, "create");
      if (!result.ok) throw badRequest("Please correct the highlighted fields", result.errors);
      if (!file) throw badRequest("Attach your proof of payment", { proof: "Required" });
      const stored = await uploads.store(file.bytes, file.filename, user, true);
      const payment = await createAsStudent("payments", user, {
        ...result.data,
        student_id: user.studentId,
        proof: stored.url,
        status: "pending",
        notes: "Uploaded by student",
      });
      return reply.code(201).send({ id: payment.id, status: payment.status });
    });

    app.get("/documents", async (request) => {
      const user = requireStudent(request);
      const { rows } = await db.query(
        "SELECT id, kind, file, expires_on, verified, created_at FROM student_documents WHERE student_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC",
        [user.studentId],
      );
      return rows;
    });

    app.post("/documents", async (request, reply) => {
      const user = requireStudent(request);
      const { fields, file } = await multipartForm(request);
      const result = validate(DOCUMENT_FIELDS, fields, "create");
      if (!result.ok) throw badRequest("Please correct the highlighted fields", result.errors);
      if (!file) throw badRequest("Attach the document", { file: "Required" });
      const stored = await uploads.store(file.bytes, file.filename, user, true);
      const document = await createAsStudent("student_documents", user, {
        kind: result.data.kind,
        student_id: user.studentId,
        file: stored.url,
        verified: false,
      });
      return reply.code(201).send(document);
    });
  };
}
