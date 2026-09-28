export function formatDate(value: unknown): string {
  if (!value) return "";
  const text = String(value);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(`${text}T00:00:00`) : new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(value: unknown): string {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(value: unknown): string {
  const date = new Date(String(value));
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function formatMoney(value: unknown, currency = "MK"): string {
  const amount = Number(value);
  return Number.isFinite(amount) ? `${currency} ${amount.toLocaleString("en-GB")}` : "";
}

export function humanize(value: unknown): string {
  const text = String(value ?? "").replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Local YYYY-MM-DD for a date input. */
export function isoDate(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}
