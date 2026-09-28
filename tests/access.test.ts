import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { effectivePermissions } from "../src/shared/permissions.js";
import {
  OWNER,
  client,
  createUser,
  login,
  setup,
  teardown,
  type Client,
  type TestContext,
} from "./helpers.js";

describe("permission rules", () => {
  it("applies per-person overrides on top of the role", () => {
    const granted = effectivePermissions("instructor", {
      "vehicles.manage": true,
      "vehicles.view": false,
    });
    expect(granted.has("vehicles.manage")).toBe(true);
    expect(granted.has("vehicles.view")).toBe(false);
    expect(granted.has("bookings.view_own")).toBe(true);
  });

  it("never lets overrides reduce an owner", () => {
    expect(effectivePermissions("owner", { "settings.manage": false }).has("settings.manage")).toBe(
      true,
    );
  });

  it("ignores unknown permission names", () => {
    const granted = effectivePermissions("office", { "made.up": true } as never);
    expect([...granted]).not.toContain("made.up");
  });
});

describe("access over the API", () => {
  let ctx: TestContext;
  let owner: Client;
  let office: Client;
  let accountant: Client;
  let instructor: Client;
  let instructorId: string;
  let officeUserId: string;

  beforeAll(async () => {
    ctx = await setup();
    owner = client(ctx.app, await login(ctx.app, OWNER.email, OWNER.password));
    const officeUser = await createUser(ctx.db, "office", "office@test.local");
    officeUserId = officeUser.id;
    office = client(ctx.app, await login(ctx.app, officeUser.email, officeUser.password));
    const accountantUser = await createUser(ctx.db, "accountant", "accounts@test.local");
    accountant = client(
      ctx.app,
      await login(ctx.app, accountantUser.email, accountantUser.password),
    );
    const instructorUser = await createUser(ctx.db, "instructor", "instructor@test.local");
    const { rows } = await ctx.db.query("SELECT id FROM instructors ORDER BY position LIMIT 1");
    instructorId = rows[0].id;
    await ctx.db.query("UPDATE instructors SET user_id = $1 WHERE id = $2", [
      instructorUser.id,
      instructorId,
    ]);
    instructor = client(
      ctx.app,
      await login(ctx.app, instructorUser.email, instructorUser.password),
    );
  });
  afterAll(() => teardown(ctx));

  it("requires sign-in", async () => {
    const response = await ctx.app.inject({ url: "/api/admin/r/students" });
    expect(response.statusCode).toBe(401);
  });

  it("refuses API writes without the anti-forgery header", async () => {
    const response = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: OWNER.email, password: OWNER.password },
    });
    expect(response.statusCode).toBe(403);
  });

  it("lets only the owner manage staff and access rights", async () => {
    expect((await office.get("/api/admin/staff")).status).toBe(403);
    expect((await office.patch(`/api/admin/staff/${officeUserId}`, { role: "owner" })).status).toBe(
      403,
    );
    expect(
      (
        await office.patch(`/api/admin/staff/${officeUserId}`, {
          permission_overrides: { "settings.manage": true },
        })
      ).status,
    ).toBe(403);
    const updated = await owner.patch(`/api/admin/staff/${officeUserId}`, {
      permission_overrides: { "settings.manage": true },
    });
    expect(updated.status).toBe(200);
    expect(updated.body.permission_overrides).toEqual({ "settings.manage": true });
  });

  it("applies the owner's overrides on the next request", async () => {
    await owner.patch(`/api/admin/staff/${officeUserId}`, {
      permission_overrides: { "content.manage": false },
    });
    const officeUser = await login(ctx.app, "office@test.local", "password-12345");
    expect((await client(ctx.app, officeUser).get("/api/admin/r/faqs")).status).toBe(403);
  });

  it("rejects unknown permissions in overrides", async () => {
    const response = await owner.patch(`/api/admin/staff/${officeUserId}`, {
      permission_overrides: { "everything.please": true },
    });
    expect(response.status).toBe(400);
  });

  it("keeps at least one active owner", async () => {
    const { rows } = await ctx.db.query("SELECT id FROM users WHERE role = 'owner'");
    const response = await owner.patch(`/api/admin/staff/${rows[0].id}`, { role: "office" });
    expect(response.status).toBe(400);
  });

  it("stops roles from editing outside their area", async () => {
    const { body } = await owner.get("/api/admin/r/courses");
    const courseId = body.items[0].id;
    expect((await accountant.patch(`/api/admin/r/courses/${courseId}`, { price: 1 })).status).toBe(
      403,
    );
    expect((await instructor.patch(`/api/admin/r/courses/${courseId}`, { price: 1 })).status).toBe(
      403,
    );
    expect((await office.put("/api/admin/settings/general", {})).status).toBe(403);
  });

  it("shows instructors only their own students", async () => {
    const mine = await office.post("/api/admin/r/students", {
      full_name: "Mine",
      phone: "0999000001",
      instructor_id: instructorId,
    });
    const other = await office.post("/api/admin/r/students", {
      full_name: "Other",
      phone: "0999000002",
    });
    const list = await instructor.get("/api/admin/r/students");
    const names = list.body.items.map((row: { full_name: string }) => row.full_name);
    expect(names).toContain("Mine");
    expect(names).not.toContain("Other");
    expect((await instructor.get(`/api/admin/r/students/${other.body.id}`)).status).toBe(404);
    expect((await instructor.get(`/api/admin/students/${mine.body.id}/profile`)).status).toBe(200);
    expect(
      (
        await instructor.post("/api/admin/r/student_notes", {
          student_id: other.body.id,
          body: "Sneaky",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await instructor.post("/api/admin/r/student_notes", {
          student_id: mine.body.id,
          body: "Good progress",
        })
      ).status,
    ).toBe(201);
  });

  it("keeps students out of the staff API", async () => {
    const student = await office.post("/api/admin/r/students", {
      full_name: "Portal User",
      phone: "0999000003",
    });
    await office.put(`/api/admin/students/${student.body.id}/portal-access`, {
      email: "student@test.local",
      password: "student-pass-1",
      active: true,
    });
    const portal = client(ctx.app, await login(ctx.app, "student@test.local", "student-pass-1"));
    expect((await portal.get("/api/admin/r/students")).status).toBe(403);
    expect((await portal.get("/api/portal/overview")).status).toBe(200);
    expect((await office.get("/api/portal/overview")).status).toBe(403);
  });

  it("validates input on the server", async () => {
    const response = await owner.post("/api/admin/r/menu_items", {
      label: "Bad",
      url: "javascript:alert(1)",
      location: "header",
    });
    expect(response.status).toBe(400);
    expect(response.body.fields.url).toBeDefined();
  });

  it("protects built-in pages from deletion", async () => {
    const { body } = await owner.get("/api/admin/r/pages?q=home");
    const home = body.items.find((page: { slug: string }) => page.slug === "home");
    expect((await owner.delete(`/api/admin/r/pages/${home.id}`)).status).toBe(403);
  });

  it("logs changes, undoes them and restores deleted items", async () => {
    const created = await owner.post("/api/admin/r/faqs", { question: "Undo me?", answer: "Yes" });
    await owner.patch(`/api/admin/r/faqs/${created.body.id}`, { question: "Changed" });
    const log = await owner.get(`/api/admin/activity?resource=faqs&record=${created.body.id}`);
    const edit = log.body.find((entry: { action: string }) => entry.action === "update");
    expect((await owner.post(`/api/admin/activity/${edit.id}/undo`)).status).toBe(204);
    expect((await owner.get(`/api/admin/r/faqs/${created.body.id}`)).body.question).toBe(
      "Undo me?",
    );

    await owner.delete(`/api/admin/r/faqs/${created.body.id}`);
    const bin = await owner.get("/api/admin/recycle-bin");
    expect(bin.body.some((item: { id: string }) => item.id === created.body.id)).toBe(true);
    expect(
      (await owner.post(`/api/admin/recycle-bin/faqs/${created.body.id}/restore`)).status,
    ).toBe(200);
    expect((await owner.get(`/api/admin/r/faqs/${created.body.id}`)).status).toBe(200);
  });

  it("refuses to undo a change that was edited again since", async () => {
    const created = await owner.post("/api/admin/r/faqs", { question: "First", answer: "A" });
    await owner.patch(`/api/admin/r/faqs/${created.body.id}`, { question: "Second" });
    await owner.patch(`/api/admin/r/faqs/${created.body.id}`, { question: "Third" });
    const log = await owner.get(`/api/admin/activity?resource=faqs&record=${created.body.id}`);
    const firstEdit = log.body
      .filter((entry: { action: string }) => entry.action === "update")
      .at(-1);
    expect((await owner.post(`/api/admin/activity/${firstEdit.id}/undo`)).status).toBe(409);
  });
});
