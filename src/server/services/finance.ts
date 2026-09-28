import type { Queryable } from "../db/pool.js";
import { badRequest } from "../errors.js";
import type { ResourceHooks } from "./repository.js";
import { loadSettings } from "./settings.js";
import { addDays } from "./time.js";

interface InvoiceLine {
  description: string;
  quantity: number;
  unit_price: number;
}

export function invoiceTotal(lines: readonly InvoiceLine[], discount = 0): number {
  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unit_price, 0);
  return Math.max(subtotal - discount, 0);
}

const pad = (value: number) => String(value).padStart(6, "0");

export const invoiceHooks: ResourceHooks = {
  extraColumns: ["number", "total"],
  async prepare(data, { db, existing }) {
    const merged = { ...existing, ...data };
    const lines = (merged.lines ?? []) as InvoiceLine[];
    if (!lines.length)
      throw badRequest("Add at least one item", { lines: "Add at least one item" });
    const total = invoiceTotal(lines, Number(merged.discount ?? 0));

    const instalments = (merged.instalments ?? []) as { amount: number }[];
    const planned = instalments.reduce((sum, instalment) => sum + instalment.amount, 0);
    if (instalments.length && planned !== total) {
      throw badRequest("Instalments must add up to the invoice total", {
        instalments: `Instalments add up to ${planned}, but the total is ${total}`,
      });
    }

    const result: Record<string, unknown> = { ...data, total };
    if (!existing) {
      const { rows } = await db.query<{ next: number }>(
        "SELECT nextval('invoice_number_seq') AS next",
      );
      result.number = `INV-${pad(rows[0]!.next)}`;
      if (!merged.due_on) {
        const days = Number((await loadSettings(db)).payments.payment_due_days ?? 0);
        result.due_on = addDays(String(merged.issued_on), days);
      }
    }
    return result;
  },
};

export const paymentHooks: ResourceHooks = {
  extraColumns: ["receipt_number"],
  async prepare(data, { db, existing }) {
    const merged = { ...existing, ...data };
    if (merged.invoice_id) {
      const { rows } = await db.query(
        "SELECT student_id FROM invoices WHERE id = $1 AND deleted_at IS NULL",
        [merged.invoice_id],
      );
      if (rows[0]?.student_id !== merged.student_id) {
        throw badRequest("That invoice belongs to a different student", {
          invoice_id: "Belongs to another student",
        });
      }
    }
    const result: Record<string, unknown> = { ...data };
    if (merged.status === "confirmed" && !existing?.receipt_number) {
      result.receipt_number = await nextReceiptNumber(db);
    }
    return result;
  },
};

export async function nextReceiptNumber(db: Queryable): Promise<string> {
  const { rows } = await db.query<{ next: number }>("SELECT nextval('receipt_number_seq') AS next");
  return `RCPT-${pad(rows[0]!.next)}`;
}

export interface Balance {
  student_id: string;
  full_name: string;
  phone: string;
  invoiced: number;
  paid: number;
  pending: number;
  balance: number;
  next_due_on: string | null;
}

/** Invoiced minus confirmed payments, per student. Pending uploads are shown but not counted. */
export async function balances(db: Queryable, studentId?: string): Promise<Balance[]> {
  const { rows } = await db.query<Balance>(
    `WITH invoiced AS (
       SELECT student_id, sum(total) AS amount, min(due_on) AS next_due_on
       FROM invoices WHERE deleted_at IS NULL GROUP BY student_id
     ), paid AS (
       SELECT student_id,
              sum(amount) FILTER (WHERE status = 'confirmed') AS confirmed,
              sum(amount) FILTER (WHERE status = 'pending') AS pending
       FROM payments WHERE deleted_at IS NULL GROUP BY student_id
     )
     SELECT s.id AS student_id, s.full_name, s.phone,
            coalesce(i.amount, 0)::int AS invoiced,
            coalesce(p.confirmed, 0)::int AS paid,
            coalesce(p.pending, 0)::int AS pending,
            (coalesce(i.amount, 0) - coalesce(p.confirmed, 0))::int AS balance,
            i.next_due_on
     FROM students s
     LEFT JOIN invoiced i ON i.student_id = s.id
     LEFT JOIN paid p ON p.student_id = s.id
     WHERE s.deleted_at IS NULL AND ($1::uuid IS NULL OR s.id = $1)
       AND (i.amount IS NOT NULL OR p.confirmed IS NOT NULL OR p.pending IS NOT NULL)
     ORDER BY balance DESC, s.full_name`,
    [studentId ?? null],
  );
  return rows;
}

/** Instalments due on or before `date` that are not yet covered by confirmed payments on that invoice. */
export async function overdueInstalments(db: Queryable, date: string) {
  const { rows } = await db.query(
    `SELECT inv.id AS invoice_id, inv.number, s.id AS student_id, s.full_name, s.phone,
            (SELECT coalesce(sum((x->>'amount')::int), 0) FROM jsonb_array_elements(inv.instalments) x
              WHERE x->>'due_on' <= $1) AS due,
            (SELECT coalesce(sum(p.amount), 0) FROM payments p
              WHERE p.invoice_id = inv.id AND p.status = 'confirmed' AND p.deleted_at IS NULL) AS paid
     FROM invoices inv JOIN students s ON s.id = inv.student_id
     WHERE inv.deleted_at IS NULL AND s.deleted_at IS NULL`,
    [date],
  );
  return rows
    .map((row) => ({ ...row, overdue: Number(row.due) - Number(row.paid) }))
    .filter((row) => row.overdue > 0);
}
