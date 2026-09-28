import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import { raw, type SafeHtml } from "./html.js";

const ALLOWED = {
  allowedTags: [...sanitizeHtml.defaults.allowedTags, "img", "h1", "h2", "h3", "h4"],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height", "loading"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["https"] },
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName: string, attribs: Record<string, string>) => ({
      tagName,
      attribs: attribs.target === "_blank" ? { ...attribs, rel: "noopener noreferrer" } : attribs,
    }),
    img: (tagName: string, attribs: Record<string, string>) => ({
      tagName,
      attribs: { ...attribs, loading: "lazy" },
    }),
  },
};

/** Staff write formatted text in Markdown; the output is sanitised so no script can get through. */
export function markdown(source: unknown): SafeHtml {
  if (typeof source !== "string" || !source.trim()) return raw("");
  const rendered = marked.parse(source, { async: false, gfm: true, breaks: false });
  return raw(sanitizeHtml(rendered, ALLOWED));
}
