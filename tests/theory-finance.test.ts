import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { invoiceTotal } from "../src/server/services/finance.js";
import { OWNER, client, login, setup, teardown, type Client, type TestContext } from "./helpers.js";

describe("theory tests and fees", () => {
  let ctx: TestContext;
  let owner: Client;
  let student: Client;
  let studentId: string;

  beforeAll(async () => {
    ctx = await setup();
    owner = client(ctx.app, await login(ctx.app, OWNER.email, OWNER.password));
    const created = await owner.post("/api/admin/r/students", {
      full_name: "Tester",
      phone: "0999222333",
    });
    studentId = created.body.id;
    await owner.put(`/api/admin/students/${studentId}/portal-access`, {
      email: "tester@test.local",
      password: "tester-pass-1",
      active: true,
    });
    student = client(ctx.app, await login(ctx.app, "tester@test.local", "tester-pass-1"));
  });
  afterAll(() => teardown(ctx));

  it("draws random questions without revealing the answers", async () => {
    const tests = await student.get("/api/portal/theory/tests");
    const quick = tests.body.find((test: { name: string }) => test.name === "Quick practice");
    const first = await student.post("/api/portal/theory/attempts", { test_id: quick.id });
    expect(first.status).toBe(201);
    expect(first.body.questions).toHaveLength(10);
    expect(JSON.stringify(first.body)).not.toMatch(/correct|explanation/);

    const orders = new Set<string>();
    for (let i = 0; i < 5; i++) {
      const attempt = await student.post("/api/portal/theory/attempts", { test_id: quick.id });
      orders.add(attempt.body.questions.map((q: { id: string }) => q.id).join());
    }
    expect(orders.size).toBeGreaterThan(1);
  });

  it("marks answers after mapping shuffled choices back", async () => {
    const tests = await student.get("/api/portal/theory/tests");
    const quick = tests.body.find((test: { name: string }) => test.name === "Quick practice");
    const attempt = await student.post("/api/portal/theory/attempts", { test_id: quick.id });
    const { rows } = await ctx.db.query("SELECT id, choices, correct_choice FROM questions");
    const correct = new Map(rows.map((row) => [row.id, row.choices[row.correct_choice - 1]]));
    const answers = Object.fromEntries(
      attempt.body.questions.map((q: { id: string; choices: string[] }) => [
        q.id,
        q.choices.indexOf(correct.get(q.id)),
      ]),
    );
    const result = await student.post(`/api/portal/theory/attempts/${attempt.body.id}/submit`, {
      answers,
    });
    expect(result.body).toMatchObject({ score: 10, total: 10, passed: true });
    expect(
      (await student.post(`/api/portal/theory/attempts/${attempt.body.id}/submit`, { answers }))
        .status,
    ).toBe(409);
    const results = await owner.get("/api/admin/theory/results");
    expect(results.body.some((row: { student_id: string }) => row.student_id === studentId)).toBe(
      true,
    );
  });

  it("totals invoices and checks instalments add up", async () => {
    expect(invoiceTotal([{ description: "a", quantity: 2, unit_price: 100 }], 50)).toBe(150);
    const lines = [{ description: "Code B course", quantity: 1, unit_price: 753000 }];
    const bad = await owner.post("/api/admin/r/invoices", {
      student_id: studentId,
      issued_on: "2026-09-01",
      lines,
      instalments: [{ due_on: "2026-09-01", amount: 100 }],
    });
    expect(bad.status).toBe(400);
    const invoice = await owner.post("/api/admin/r/invoices", {
      student_id: studentId,
      issued_on: "2026-09-01",
      lines,
      instalments: [
        { due_on: "2026-09-01", amount: 353000 },
        { due_on: "2026-10-01", amount: 400000 },
      ],
    });
    expect(invoice.status).toBe(201);
    expect(invoice.body).toMatchObject({
      total: 753000,
      number: "INV-000001",
      due_on: "2026-09-15",
    });
  });

  it("counts only confirmed payments towards the balance", async () => {
    await owner.post("/api/admin/r/payments", {
      student_id: studentId,
      amount: 353000,
      method: "cash",
      paid_on: "2026-09-02",
      status: "confirmed",
    });
    const form = new FormData();
    form.append("amount", "400000");
    form.append("method", "airtel_money");
    form.append("paid_on", "2026-09-03");
    form.append(
      "proof",
      new Blob([Buffer.from("%PDF-1.4 test")], { type: "application/pdf" }),
      "proof.pdf",
    );
    const request = new Request("http://test/", { method: "POST", body: form });
    const upload = await ctx.app.inject({
      method: "POST",
      url: "/api/portal/payments",
      headers: {
        cookie: await login(ctx.app, "tester@test.local", "tester-pass-1"),
        "x-requested-with": "fetch",
        "content-type": request.headers.get("content-type")!,
      },
      payload: Buffer.from(await request.arrayBuffer()),
    });
    expect(upload.statusCode).toBe(201);
    const balances = await owner.get("/api/admin/finance/balances");
    expect(
      balances.body.find((row: { student_id: string }) => row.student_id === studentId),
    ).toMatchObject({
      invoiced: 753000,
      paid: 353000,
      pending: 400000,
      balance: 400000,
    });
  });

  it("issues a receipt number when a payment is confirmed", async () => {
    const { rows } = await ctx.db.query("SELECT id FROM payments WHERE status = 'pending'");
    const confirmed = await owner.patch(`/api/admin/r/payments/${rows[0].id}`, {
      status: "confirmed",
    });
    expect(confirmed.body.receipt_number).toMatch(/^RCPT-\d{6}$/);
  });
});
