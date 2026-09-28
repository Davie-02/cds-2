import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import type { Services } from "../app.js";
import { getResource } from "../../shared/resources.js";
import { SETTINGS_GROUPS } from "../../shared/settings.js";
import { badRequest, forbidden, notFound } from "../errors.js";
import { toActor } from "../services/repository.js";
import { dashboard, passRates } from "../services/dashboard.js";
import { balances } from "../services/finance.js";
import { availableSlots } from "../services/bookings.js";
import { loadSettings, saveSettingsGroup } from "../services/settings.js";
import { isValidTimeZone } from "../services/time.js";
import { printInvoice, printReceipt } from "../site/print.js";
import { isUuid, noContent, params, queryNumber, queryString, requireStaff } from "./common.js";

function listQuery(request: FastifyRequest) {
  const query = request.query as Record<string, unknown>;
  const filters: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (key.startsWith("filter.") && typeof value === "string" && value !== "")
      filters[key.slice(7)] = value;
  }
  return {
    search: queryString(request, "q"),
    filters,
    page: queryNumber(request, "page"),
    limit: queryNumber(request, "limit"),
  };
}

function resourceParam(request: FastifyRequest) {
  const def = getResource(params(request).resource ?? "");
  if (!def) throw notFound("Section");
  return def;
}

export function adminRoutes(services: Services): FastifyPluginAsync {
  const { db, repository, bookings, students, theory, staff, history, uploads } = services;

  return async (app) => {
    app.addHook("preHandler", async (request) => {
      requireStaff(request);
    });

    app.get("/r/:resource", async (request) => {
      return repository.list(resourceParam(request), requireStaff(request), listQuery(request));
    });

    app.get("/r/:resource/:id", async (request) => {
      return repository.get(resourceParam(request), params(request).id!, requireStaff(request));
    });

    app.post("/r/:resource", async (request, reply) => {
      const row = await repository.create(
        resourceParam(request),
        request.body,
        requireStaff(request),
      );
      return reply.code(201).send(row);
    });

    app.patch("/r/:resource/:id", async (request) => {
      return repository.update(
        resourceParam(request),
        params(request).id!,
        request.body,
        requireStaff(request),
      );
    });

    app.delete("/r/:resource/:id", async (request, reply) => {
      await repository.remove(resourceParam(request), params(request).id!, requireStaff(request));
      return noContent(reply);
    });

    app.post("/r/:resource/reorder", async (request, reply) => {
      const ids = (request.body as { ids?: unknown })?.ids;
      if (!Array.isArray(ids) || !ids.length || ids.length > 500 || !ids.every(isUuid)) {
        throw badRequest("Send the items in their new order");
      }
      await repository.reorder(resourceParam(request), ids, requireStaff(request));
      return noContent(reply);
    });

    app.get("/options/:resource", async (request) => {
      const user = requireStaff(request);
      if (params(request).resource === "staff") return staff.options(user);
      return repository.options(resourceParam(request), user);
    });

    app.get("/settings", async (request) => {
      requireStaff(request, "settings.manage");
      return loadSettings(db);
    });

    app.put("/settings/:group", async (request) => {
      const user = requireStaff(request, "settings.manage");
      const group = params(request).group!;
      const body = request.body as Record<string, unknown> | undefined;
      if (group === "booking" && body?.timezone && !isValidTimeZone(String(body.timezone))) {
        throw badRequest("Unknown time zone", { timezone: "Use a name like Africa/Blantyre" });
      }
      if (!Object.hasOwn(SETTINGS_GROUPS, group)) throw notFound("Settings group");
      return saveSettingsGroup(db, group, body, toActor(user));
    });

    app.post("/uploads", async (request, reply) => {
      const user = requireStaff(request);
      const file = await request.file();
      if (!file) throw badRequest("Choose a file to upload");
      const bytes = await file.toBuffer();
      const isPrivate = queryString(request, "private") === "1";
      return reply.code(201).send(await uploads.store(bytes, file.filename, user, isPrivate));
    });

    app.get("/staff", async (request) => staff.list(requireStaff(request)));
    app.post("/staff", async (request, reply) => {
      return reply.code(201).send(await staff.save(requireStaff(request), null, request.body));
    });
    app.patch("/staff/:id", async (request) =>
      staff.save(requireStaff(request), params(request).id!, request.body),
    );
    app.delete("/staff/:id", async (request, reply) => {
      await staff.remove(requireStaff(request), params(request).id!);
      return noContent(reply);
    });

    app.get("/activity", async (request) => {
      requireStaff(request, "activity.view");
      return history.activity({
        page: queryNumber(request, "page"),
        resource: queryString(request, "resource"),
        recordId: queryString(request, "record"),
      });
    });
    app.post("/activity/:id/undo", async (request, reply) => {
      const id = Number(params(request).id);
      if (!Number.isInteger(id)) throw notFound("Activity entry");
      await history.undo(id, requireStaff(request));
      return noContent(reply);
    });

    app.get("/recycle-bin", async (request) => history.recycleBin(requireStaff(request)));
    app.post("/recycle-bin/:resource/:id/restore", async (request) => {
      return history.restore(params(request).resource!, params(request).id!, requireStaff(request));
    });
    app.delete("/recycle-bin/:resource/:id", async (request, reply) => {
      await history.purge(params(request).resource!, params(request).id!, requireStaff(request));
      return noContent(reply);
    });

    app.get("/dashboard", async (request) =>
      dashboard(db, requireStaff(request, "dashboard.view")),
    );

    app.get("/calendar", async (request) => {
      const from = queryString(request, "from");
      const to = queryString(request, "to");
      if (!from || !to || Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) {
        throw badRequest("Choose a date range");
      }
      return bookings.calendar(requireStaff(request), {
        from,
        to,
        instructor_id: queryString(request, "instructor_id"),
        vehicle_id: queryString(request, "vehicle_id"),
      });
    });

    app.get("/availability", async (request) => {
      requireStaff(request, "bookings.manage");
      const studentId = queryString(request, "student_id");
      const instructorId = queryString(request, "instructor_id");
      const date = queryString(request, "date");
      if (!isUuid(studentId) || !isUuid(instructorId) || !date)
        throw badRequest("Choose a student, instructor and date");
      return availableSlots(db, studentId, instructorId, date);
    });

    app.post("/bookings/:id/outcome", async (request) => {
      return bookings.recordOutcome(
        requireStaff(request),
        params(request).id!,
        request.body as Record<string, string>,
      );
    });

    app.get("/students/:id/profile", async (request) =>
      students.profile(params(request).id!, requireStaff(request)),
    );

    app.put("/students/:id/skills/:skillId", async (request, reply) => {
      const level = (request.body as { level?: unknown })?.level;
      await students.setSkill(
        params(request).id!,
        params(request).skillId!,
        String(level),
        requireStaff(request),
      );
      return noContent(reply);
    });

    app.put("/students/:id/portal-access", async (request, reply) => {
      await students.setPortalAccess(params(request).id!, request.body, requireStaff(request));
      return noContent(reply);
    });

    app.get("/theory/results", async (request) => {
      requireStaff(request, "theory.results", "theory.manage");
      return theory.allResults();
    });

    app.get("/finance/balances", async (request) => {
      requireStaff(request, "finance.view");
      return balances(db);
    });

    app.get("/reports/pass-rates", async (request) => {
      requireStaff(request, "tests.manage", "students.view");
      return passRates(db);
    });

    app.get("/print/invoice/:id", async (request, reply) => {
      const user = requireStaff(request, "finance.view");
      const invoice = await repository.get(getResource("invoices")!, params(request).id!, user);
      return reply.type("text/html").send(await printInvoice(db, invoice));
    });

    app.get("/print/receipt/:id", async (request, reply) => {
      const user = requireStaff(request, "finance.view");
      const payment = await repository.get(getResource("payments")!, params(request).id!, user);
      if (payment.status !== "confirmed")
        throw forbidden("Receipts are issued for confirmed payments only");
      return reply.type("text/html").send(await printReceipt(db, payment));
    });
  };
}
