import type { FieldErrors } from "../shared/validation.js";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly fieldErrors?: FieldErrors,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, fieldErrors?: FieldErrors) =>
  new HttpError(400, message, fieldErrors);
export const unauthorized = () => new HttpError(401, "Please sign in");
export const forbidden = (message = "You do not have permission to do that") =>
  new HttpError(403, message);
export const notFound = (what = "Item") => new HttpError(404, `${what} not found`);
export const conflict = (message: string, fieldErrors?: FieldErrors) =>
  new HttpError(409, message, fieldErrors);

/** Postgres error codes the app translates into friendly messages. */
export const PG = {
  uniqueViolation: "23505",
  foreignKeyViolation: "23503",
  exclusionViolation: "23P01",
} as const;

export function pgCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code: unknown }).code)
    : undefined;
}

export function pgConstraint(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "constraint" in error
    ? String((error as { constraint: unknown }).constraint)
    : undefined;
}
