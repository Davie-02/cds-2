import type { Queryable } from "../db/pool.js";
import { loadSettings } from "../services/settings.js";
import { formatDate, formatMoney } from "./format.js";
import { html, safeSrc, type SafeHtml } from "./html.js";

type Row = Record<string, any>;

async function studentFor(db: Queryable, id: string): Promise<Row> {
  const { rows } = await db.query(
    "SELECT full_name, phone, email, address FROM students WHERE id = $1",
    [id],
  );
  return rows[0] ?? {};
}

function document(title: string, body: SafeHtml): string {
  return html`<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${title}</title>
        <link rel="stylesheet" href="/css/print.css" />
      </head>
      <body>
        <p class="no-print">
          <button type="button" onclick="window.print()">Print or save as PDF</button>
        </p>
        ${body}
      </body>
    </html>`.value;
}

async function letterhead(db: Queryable) {
  const settings = await loadSettings(db);
  const general = settings.general as Row;
  const contact = settings.contact as Row;
  const head = html`<header class="letterhead">
    ${general.logo ? html`<img src="${safeSrc(general.logo)}" alt="" />` : ""}
    <div>
      <h1>${general.school_name}</h1>
      <p>${[contact.address, contact.phone, contact.email].filter(Boolean).join(" · ")}</p>
    </div>
  </header>`;
  return { settings, head };
}

export async function printInvoice(db: Queryable, invoice: Row): Promise<string> {
  const { settings, head } = await letterhead(db);
  const payments = settings.payments as Row;
  const currency = String(payments.currency ?? "");
  const money = (value: unknown) => formatMoney(value, currency);
  const student = await studentFor(db, invoice.student_id);
  const { rows: paid } = await db.query<{ total: number }>(
    "SELECT coalesce(sum(amount), 0)::int AS total FROM payments WHERE invoice_id = $1 AND status = 'confirmed' AND deleted_at IS NULL",
    [invoice.id],
  );
  const paidTotal = paid[0]?.total ?? 0;
  const bank = [
    payments.bank_name && `Bank: ${payments.bank_name}`,
    payments.bank_account_name && `Account name: ${payments.bank_account_name}`,
    payments.bank_account_number && `Account number: ${payments.bank_account_number}`,
    payments.bank_branch && `Branch: ${payments.bank_branch}`,
  ].filter(Boolean);

  return document(
    `Invoice ${invoice.number}`,
    html`${head}
      <section class="parties">
        <div>
          <h2>Invoice ${invoice.number}</h2>
          <p>Date: ${formatDate(invoice.issued_on)}</p>
          ${invoice.due_on ? html`<p>Due: ${formatDate(invoice.due_on)}</p>` : ""}
        </div>
        <div>
          <h3>Bill to</h3>
          <p>${student.full_name}</p>
          <p>${student.phone}</p>
          ${student.email ? html`<p>${student.email}</p>` : ""}
        </div>
      </section>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Unit price</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          ${(invoice.lines ?? []).map(
            (line: Row) =>
              html`<tr>
                <td>${line.description}</td>
                <td>${line.quantity}</td>
                <td>${money(line.unit_price)}</td>
                <td>${money(line.quantity * line.unit_price)}</td>
              </tr>`,
          )}
        </tbody>
        <tfoot>
          ${
            invoice.discount
              ? html`<tr>
                  <td colspan="3">Discount</td>
                  <td>−${money(invoice.discount)}</td>
                </tr>`
              : ""
          }
          <tr>
            <th colspan="3">Total</th>
            <th>${money(invoice.total)}</th>
          </tr>
          <tr>
            <td colspan="3">Paid</td>
            <td>${money(paidTotal)}</td>
          </tr>
          <tr>
            <th colspan="3">Balance</th>
            <th>${money(invoice.total - paidTotal)}</th>
          </tr>
        </tfoot>
      </table>
      ${
        invoice.instalments?.length
          ? html`<h3>Instalment plan</h3>
              <table>
                <tbody>
                  ${invoice.instalments.map(
                    (item: Row) =>
                      html`<tr>
                        <td>${formatDate(item.due_on)}</td>
                        <td>${money(item.amount)}</td>
                      </tr>`,
                  )}
                </tbody>
              </table>`
          : ""
      }
      ${
        bank.length || payments.mobile_money
          ? html`<h3>How to pay</h3>
              ${bank.map((line) => html`<p>${line}</p>`)}${payments.mobile_money ? html`<p>${payments.mobile_money}</p>` : ""}`
          : ""
      }
      ${payments.invoice_note ? html`<p class="note">${payments.invoice_note}</p>` : ""}`,
  );
}

export async function printReceipt(db: Queryable, payment: Row): Promise<string> {
  const { settings, head } = await letterhead(db);
  const currency = String((settings.payments as Row).currency ?? "");
  const student = await studentFor(db, payment.student_id);
  const { rows } = payment.invoice_id
    ? await db.query("SELECT number FROM invoices WHERE id = $1", [payment.invoice_id])
    : { rows: [] as Row[] };

  return document(
    `Receipt ${payment.receipt_number}`,
    html`${head}
      <section class="parties">
        <div>
          <h2>Receipt ${payment.receipt_number}</h2>
          <p>Date: ${formatDate(payment.paid_on)}</p>
        </div>
        <div>
          <h3>Received from</h3>
          <p>${student.full_name}</p>
          <p>${student.phone}</p>
        </div>
      </section>
      <table>
        <tbody>
          <tr>
            <th>Amount</th>
            <td>${formatMoney(payment.amount, currency)}</td>
          </tr>
          <tr>
            <th>Method</th>
            <td>${String(payment.method).replace(/_/g, " ")}</td>
          </tr>
          ${
            payment.reference
              ? html`<tr>
                  <th>Reference</th>
                  <td>${payment.reference}</td>
                </tr>`
              : ""
          }
          ${
            rows[0]
              ? html`<tr>
                  <th>For invoice</th>
                  <td>${rows[0].number}</td>
                </tr>`
              : ""
          }
        </tbody>
      </table>
      <p class="note">Thank you for your payment.</p>`,
  );
}
