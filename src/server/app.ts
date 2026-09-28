import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import formbody from "@fastify/formbody";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import type { Config } from "./config.js";
import type { Db } from "./db/pool.js";
import { HttpError, pgCode } from "./errors.js";
import { adminRoutes } from "./routes/admin.js";
import { authRoutes } from "./routes/auth.js";
import { SESSION_COOKIE } from "./routes/common.js";
import { portalRoutes } from "./routes/portal.js";
import { siteRoutes } from "./routes/site.js";
import { staticRoutes } from "./routes/static.js";
import { userForSession } from "./services/auth.js";
import { BookingService, bookingHooks } from "./services/bookings.js";
import { pageHooks, postHooks, sectionHooks } from "./services/content.js";
import { invoiceHooks, paymentHooks } from "./services/finance.js";
import { HistoryService } from "./services/history.js";
import { Repository } from "./services/repository.js";
import { StaffService } from "./services/staff.js";
import { StudentService, studentNoteHooks } from "./services/students.js";
import { TheoryService, questionHooks } from "./services/theory.js";
import { UploadService } from "./services/uploads.js";

export interface Services {
  db: Db;
  config: Config;
  repository: Repository;
  bookings: BookingService;
  students: StudentService;
  theory: TheoryService;
  staff: StaffService;
  history: HistoryService;
  uploads: UploadService;
}

export function createServices(db: Db, config: Config): Services {
  const repository = new Repository(db, {
    pages: pageHooks,
    sections: sectionHooks,
    posts: postHooks,
    bookings: bookingHooks,
    invoices: invoiceHooks,
    payments: paymentHooks,
    questions: questionHooks,
    student_notes: studentNoteHooks,
  });
  return {
    db,
    config,
    repository,
    bookings: new BookingService(db, repository),
    students: new StudentService(db, repository),
    theory: new TheoryService(db),
    staff: new StaffService(db),
    history: new HistoryService(db, repository),
    uploads: new UploadService(db, config.MAX_UPLOAD_MB * 1_048_576),
  };
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export async function buildApp(services: Services): Promise<FastifyInstance> {
  const { config, db } = services;
  const app = Fastify({
    logger:
      config.NODE_ENV === "test"
        ? false
        : { level: config.NODE_ENV === "production" ? "info" : "debug" },
    trustProxy: config.TRUST_PROXY,
    bodyLimit: 1_048_576,
  });

  await app.register(cookie, { secret: config.SESSION_SECRET });
  await app.register(formbody);
  await app.register(multipart, {
    limits: { fileSize: config.MAX_UPLOAD_MB * 1_048_576, files: 1 },
  });
  await app.register(rateLimit, { global: false });

  app.decorateRequest("user", null);
  app.addHook("onRequest", async (request) => {
    const signed = request.cookies[SESSION_COOKIE];
    const token = signed ? request.unsignCookie(signed) : null;
    if (token?.valid && token.value) request.user = await userForSession(db, token.value);
  });

  // Cross-site pages cannot add custom headers without a CORS preflight, which this API never
  // grants, so requiring one blocks cross-site request forgery on the JSON API.
  app.addHook("onRequest", async (request, reply) => {
    if (
      request.url.startsWith("/api/") &&
      MUTATING.has(request.method) &&
      !request.headers["x-requested-with"]
    ) {
      return reply.code(403).send({ error: "Missing request header" });
    }
  });

  app.addHook("onSend", async (_request, reply) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
    reply.header("X-Frame-Options", "SAMEORIGIN");
  });

  app.setErrorHandler((error: FastifyError | HttpError, request, reply) => {
    if (error instanceof HttpError) {
      return reply.code(error.status).send({ error: error.message, fields: error.fieldErrors });
    }
    // Malformed ids in URLs reach Postgres as invalid uuids; treat them as missing records.
    if (pgCode(error) === "22P02") return reply.code(404).send({ error: "Not found" });
    if (error.statusCode && error.statusCode < 500) {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error(error);
    return reply.code(500).send({ error: "Something went wrong. Please try again." });
  });

  await app.register(authRoutes(services), { prefix: "/api/auth" });
  await app.register(adminRoutes(services), { prefix: "/api/admin" });
  await app.register(portalRoutes(services), { prefix: "/api/portal" });
  await app.register(staticRoutes(services));
  await app.register(siteRoutes(services));
  return app;
}
