export function formatDate(value: unknown): string {
  const date = value instanceof Date ? value : new Date(`${String(value)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return String(value ?? "");
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatMoney(amount: unknown, currency: string): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "";
  return `${currency} ${value.toLocaleString("en-GB")}`.trim();
}

/** Builds a wa.me link from a phone number in any common format; null when there is no number. */
export function whatsappLink(number: unknown, message?: unknown): string | null {
  const digits = String(number ?? "").replace(/\D/g, "");
  if (digits.length < 7) return null;
  const text = typeof message === "string" && message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${digits}${text}`;
}
