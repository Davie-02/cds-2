import { SLUG_PATTERN } from "../../shared/resources.js";
import { sectionFields } from "../../shared/sections.js";
import { validate } from "../../shared/validation.js";
import { badRequest, forbidden } from "../errors.js";
import type { ResourceHooks } from "./repository.js";

const RESERVED_SLUGS = new Set([
  "admin",
  "portal",
  "api",
  "app",
  "uploads",
  "images",
  "css",
  "js",
  "enquiries",
]);

function checkSlug(slug: unknown) {
  const value = String(slug ?? "");
  if (!SLUG_PATTERN.test(value)) {
    throw badRequest("Use lowercase letters, numbers and hyphens", {
      slug: "Lowercase letters, numbers and hyphens only",
    });
  }
  if (RESERVED_SLUGS.has(value))
    throw badRequest("That web address is reserved", { slug: "Reserved, choose another" });
}

export const pageHooks: ResourceHooks = {
  async prepare(data, { existing }) {
    if (data.slug !== undefined) checkSlug(data.slug);
    if (existing?.is_system && data.slug !== undefined && data.slug !== existing.slug) {
      throw badRequest("Built-in pages keep their web address", {
        slug: "Built-in pages keep their web address",
      });
    }
    return data;
  },
  async beforeDelete(row) {
    if (row.is_system) throw forbidden("Built-in pages can be hidden but not deleted");
  },
};

export const postHooks: ResourceHooks = {
  async prepare(data) {
    if (data.slug !== undefined) checkSlug(data.slug);
    return data;
  },
};

/** Each section's content is validated against its own type's field list. */
export const sectionHooks: ResourceHooks = {
  extraColumns: ["content"],
  jsonColumns: ["content"],
  async prepare(data, { existing, input }) {
    const type = String(data.type ?? existing?.type ?? "");
    if (existing && data.type !== undefined && data.type !== existing.type) {
      throw badRequest("A section's type cannot be changed; add a new section instead");
    }
    const content = (input as { content?: unknown } | undefined)?.content;
    if (content === undefined && existing) return data;
    return { ...data, content: validateSectionContent(type, content ?? {}) };
  },
};

export function validateSectionContent(type: string, content: unknown): Record<string, unknown> {
  const fields = sectionFields(type);
  if (!fields) throw badRequest("Unknown section type", { type: "Unknown section type" });
  const result = validate(fields, content, "create");
  if (!result.ok) {
    const errors = Object.fromEntries(
      Object.entries(result.errors).map(([key, message]) => [`content.${key}`, message]),
    );
    throw badRequest("Please correct the highlighted fields", errors);
  }
  return result.data;
}
