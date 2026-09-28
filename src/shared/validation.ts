import { z } from "zod";
import { DEFAULT_TEXT_MAX, type Field } from "./fields.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const PHONE = /^\+?[0-9 ()-]{7,20}$/;
const COLOR = /^#[0-9a-f]{6}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Accepts links an editor can reasonably mean: web pages, site-relative paths, anchors,
 * mail/phone links. Rejects script-capable schemes and protocol-relative URLs, which could
 * point anywhere.
 */
export function isSafeLink(value: string): boolean {
  const link = value.trim();
  if (link.startsWith("//")) return false;
  if (link.startsWith("/") || link.startsWith("#")) return !/[\s<>"]/.test(link);
  if (/^(mailto|tel):[^\s<>"]+$/i.test(link)) return true;
  try {
    const url = new URL(link);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/** Uploaded assets and bundled images live on this site; external media must be https. */
export function isSafeAssetUrl(value: string): boolean {
  if (/^\/(uploads|images)\/[\w./-]+$/.test(value) && !value.includes("..")) return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function isValidDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

const blankToNull = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? null : value;

function textSchema(field: Field) {
  const max = field.max ?? DEFAULT_TEXT_MAX[field.type] ?? 200;
  const base = z.string().trim().max(max, `${field.label} must be at most ${max} characters`);
  return field.min ? base.min(field.min, `${field.label} is too short`) : base;
}

function valueSchema(field: Field): z.ZodType {
  const label = field.label;
  switch (field.type) {
    case "text":
    case "textarea":
    case "markdown":
      return textSchema(field);
    case "password":
      return z.string().min(10, "Password must be at least 10 characters").max(200);
    case "email":
      return textSchema(field).regex(EMAIL, `${label} must be a valid email address`).toLowerCase();
    case "phone":
      return textSchema(field).regex(PHONE, `${label} must be a valid phone number`);
    case "url":
      return textSchema(field).refine(isSafeLink, `${label} must be a web address or site path`);
    case "image":
    case "media":
    case "file":
      return textSchema(field).refine(
        isSafeAssetUrl,
        `${label} must be an uploaded file or https link`,
      );
    case "color":
      return z.string().regex(COLOR, `${label} must be a colour like #1c2024`);
    case "number": {
      let schema = z.coerce
        .number({ error: `${label} must be a number` })
        .int(`${label} must be a whole number`);
      if (field.min !== undefined)
        schema = schema.min(field.min, `${label} must be at least ${field.min}`);
      if (field.max !== undefined)
        schema = schema.max(field.max, `${label} must be at most ${field.max}`);
      return schema;
    }
    case "money":
      return z.coerce
        .number({ error: `${label} must be an amount` })
        .int(`${label} must be a whole amount`)
        .min(field.min ?? 0, `${label} cannot be negative`)
        .max(field.max ?? 1_000_000_000);
    case "boolean":
      return z.boolean();
    case "date":
      return z.string().refine(isValidDate, `${label} must be a valid date`);
    case "datetime":
      return z
        .string()
        .refine(
          (value) => !Number.isNaN(Date.parse(value)),
          `${label} must be a valid date and time`,
        )
        .transform((value) => new Date(value).toISOString());
    case "time":
      return z.string().regex(TIME, `${label} must be a time like 07:30`);
    case "select":
    case "icon":
      return z.enum(optionValues(field), { error: `${label} has an invalid choice` });
    case "multiselect":
      return z.array(z.enum(optionValues(field))).max(field.max ?? 50);
    case "tags":
      return z.array(z.string().trim().min(1).max(300)).max(field.max ?? 50);
    case "reference":
      return z.string().regex(UUID, `${label} is not a valid selection`);
    case "list":
      return z.array(objectSchema(field.fields ?? [], "create")).max(field.max ?? 100);
  }
}

function optionValues(field: Field): [string, ...string[]] {
  const values = (field.options ?? []).map((option) => option.value);
  if (!values.length) throw new Error(`Field ${field.name} has no options`);
  return values as [string, ...string[]];
}

function fieldSchema(field: Field, mode: Mode): z.ZodType {
  const schema = valueSchema(field);
  const isCollection = ["multiselect", "tags", "list"].includes(field.type);
  if (field.type === "boolean")
    return mode === "create" ? schema.default(Boolean(field.default)) : schema.optional();
  if (isCollection) return mode === "create" ? schema.default([]) : schema.optional();
  if (field.required) {
    const required = z
      .preprocess(blankToNull, schema.nullish())
      .refine((value) => value !== null && value !== undefined, `${field.label} is required`);
    return mode === "create" ? required : required.optional();
  }
  return z.preprocess(blankToNull, schema.nullable()).optional();
}

export type Mode = "create" | "update";

/**
 * Builds the validator for a field list. Unknown keys are dropped so a client can never
 * write columns the field list does not declare (ids, timestamps, access rights).
 */
export function objectSchema(fields: readonly Field[], mode: Mode) {
  const shape: Record<string, z.ZodType> = {};
  for (const field of fields) {
    if (field.readOnly) continue;
    shape[field.name] = fieldSchema(field, mode);
  }
  return z.object(shape).strip();
}

export interface FieldErrors {
  [field: string]: string;
}

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; errors: FieldErrors };

export function validate(
  fields: readonly Field[],
  input: unknown,
  mode: Mode,
): ValidationResult<Record<string, unknown>> {
  const result = objectSchema(fields, mode).safeParse(input ?? {});
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, errors: flattenIssues(result.error.issues) };
}

export function flattenIssues(issues: readonly z.core.$ZodIssue[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    const key = issue.path.join(".") || "_";
    errors[key] ??= issue.message;
  }
  return errors;
}
