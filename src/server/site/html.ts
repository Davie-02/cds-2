import { isSafeAssetUrl, isSafeLink } from "../../shared/validation.js";

/** Markup that is already safe to insert. Everything else passed to `html` is escaped. */
export class SafeHtml {
  constructor(readonly value: string) {}
  toString(): string {
    return this.value;
  }
}

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPES[char]!);
}

export const raw = (markup: string) => new SafeHtml(markup);

function render(value: unknown): string {
  if (value === null || value === undefined || value === false) return "";
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(render).join("");
  return escapeHtml(String(value));
}

export function html(strings: TemplateStringsArray, ...values: unknown[]): SafeHtml {
  let out = strings[0]!;
  values.forEach((value, index) => {
    out += render(value) + strings[index + 1]!;
  });
  return new SafeHtml(out);
}

/** Links are validated on save; this guards anything that slipped in some other way. */
export const safeHref = (url: unknown) => (typeof url === "string" && isSafeLink(url) ? url : "#");
export const safeSrc = (url: unknown) =>
  typeof url === "string" && isSafeAssetUrl(url) ? url : "";

export const text = (value: unknown) =>
  typeof value === "string" ? value : value == null ? "" : String(value);
