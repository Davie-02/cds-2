import { useState } from "react";
import { DOCUMENT_KINDS, PAYMENT_METHODS, documentLabel } from "../../shared/resources";
import { Empty, Loading, Message, Status } from "../components/ui";
import { api } from "../lib/api";
import { formatDate, formatMoney, humanize, isoDate } from "../lib/format";
import { useLoad } from "../lib/useLoad";

type Row = Record<string, any>;

interface Finance {
  invoices: Row[];
  payments: Row[];
  balance: { balance: number } | null;
  payment_details: Record<string, string | null>;
}

/** Posts a form with its file field; returns the error message, if any. */
async function sendForm(path: string, form: HTMLFormElement): Promise<string | null> {
  try {
    await api.post(path, new FormData(form));
    form.reset();
    return null;
  } catch (err) {
    return (err as Error).message;
  }
}

export function PaymentsScreen() {
  const finance = useLoad(() => api.get<Finance>("/api/portal/finance"), []);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (finance.loading && !finance.data) return <Loading />;
  if (finance.error || !finance.data) return <Message type="error">{finance.error}</Message>;
  const { invoices, payments, balance, payment_details: details } = finance.data;
  const currency = details.currency ?? "";
  const bank = [
    details.bank_name,
    details.bank_account_name,
    details.bank_account_number,
    details.bank_branch,
  ].filter(Boolean);

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const error = await sendForm("/api/portal/payments", event.currentTarget);
    setBusy(false);
    setMessage(
      error
        ? { type: "error", text: error }
        : {
            type: "success",
            text: "Thank you. The office will check your payment and send a receipt.",
          },
    );
    if (!error) finance.reload();
  }

  return (
    <>
      <h1>Payments</h1>
      <section className="panel">
        <h2>Balance: {formatMoney(balance?.balance ?? 0, currency)}</h2>
        {(bank.length > 0 || details.mobile_money) && (
          <>
            <h3>How to pay</h3>
            {bank.map((line) => (
              <p key={line}>{line}</p>
            ))}
            {details.mobile_money && <p>{details.mobile_money}</p>}
          </>
        )}
      </section>

      <form className="panel" onSubmit={upload}>
        <h2>Send proof of payment</h2>
        {message && <Message type={message.type}>{message.text}</Message>}
        <label className="field">
          <span>Amount</span>
          <input name="amount" type="number" inputMode="numeric" min={1} required />
        </label>
        <label className="field">
          <span>Paid on</span>
          <input name="paid_on" type="date" defaultValue={isoDate(new Date())} required />
        </label>
        <label className="field">
          <span>Method</span>
          <select name="method" required>
            {PAYMENT_METHODS.map((method) => (
              <option key={method.value} value={method.value}>
                {method.label}
              </option>
            ))}
          </select>
        </label>
        {invoices.length > 0 && (
          <label className="field">
            <span>For invoice</span>
            <select name="invoice_id">
              <option value="">Not sure</option>
              {invoices.map((invoice) => (
                <option key={invoice.id} value={invoice.id}>
                  {invoice.number}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="field">
          <span>Transaction reference</span>
          <input name="reference" maxLength={80} />
        </label>
        <label className="field">
          <span>Photo or PDF of the receipt</span>
          <input name="proof" type="file" accept="image/*,application/pdf" required />
        </label>
        <button className="button button--primary" disabled={busy}>
          {busy ? "Sending…" : "Send"}
        </button>
      </form>

      <h2>Invoices</h2>
      {invoices.length ? (
        <ul className="agenda">
          {invoices.map((invoice) => (
            <li key={invoice.id}>
              <a href={`/api/portal/invoices/${invoice.id}/print`} target="_blank" rel="noreferrer">
                <strong>{invoice.number}</strong> {formatDate(invoice.issued_on)}
              </a>
              <span>{formatMoney(invoice.total, currency)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No invoices yet.</Empty>
      )}

      <h2>Payments</h2>
      {payments.length ? (
        <ul className="agenda">
          {payments.map((payment) => (
            <li key={payment.id}>
              <span>
                <strong>{formatMoney(payment.amount, currency)}</strong>{" "}
                {formatDate(payment.paid_on)} · {humanize(payment.method)}
                {payment.receipt_number && (
                  <span className="muted"> · {payment.receipt_number}</span>
                )}
              </span>
              <Status value={payment.status} />
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No payments yet.</Empty>
      )}
    </>
  );
}

export function DocumentsScreen() {
  const documents = useLoad(() => api.get<Row[]>("/api/portal/documents"), []);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const error = await sendForm("/api/portal/documents", event.currentTarget);
    setBusy(false);
    setMessage(
      error
        ? { type: "error", text: error }
        : { type: "success", text: "Uploaded. The office will check it." },
    );
    if (!error) documents.reload();
  }

  return (
    <>
      <h1>Documents</h1>
      <form className="panel" onSubmit={upload}>
        <h2>Upload a document</h2>
        {message && <Message type={message.type}>{message.text}</Message>}
        <label className="field">
          <span>Document</span>
          <select name="kind" required>
            {DOCUMENT_KINDS.map((kind) => (
              <option key={kind.value} value={kind.value}>
                {kind.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Photo or PDF</span>
          <input name="file" type="file" accept="image/*,application/pdf" required />
        </label>
        <button className="button button--primary" disabled={busy}>
          {busy ? "Uploading…" : "Upload"}
        </button>
      </form>
      {documents.loading ? (
        <Loading />
      ) : documents.data?.length ? (
        <ul className="agenda">
          {documents.data.map((doc) => (
            <li key={doc.id}>
              <a href={doc.file} target="_blank" rel="noreferrer">
                {documentLabel(doc.kind)}
              </a>
              <Status value={doc.verified ? "confirmed" : "pending"} />
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No documents uploaded yet.</Empty>
      )}
    </>
  );
}
