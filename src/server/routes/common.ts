import type { FastifyReply, FastifyRequest } from "fastify";
import type { Permission } from "../../shared/permissions.js";
import { hasAny } from "../../shared/permissions.js";
import { forbidden, unauthorized } from "../errors.js";
import type { CurrentUser } from "../services/auth.js";

declare module "fastify" {
  interface FastifyRequest {
    user: CurrentUser | null;
  }
}

export const SESSION_COOKIE = "sid";

export function requireUser(request: FastifyRequest): CurrentUser {
  if (!request.user) throw unauthorized();
  return request.user;
}

export function requireStaff(request: FastifyRequest, ...anyOf: Permission[]): CurrentUser {
  const user = requireUser(request);
  if (user.role === "student") throw forbidden();
  if (anyOf.length && !hasAny(user.permissions, ...anyOf)) throw forbidden();
  return user;
}

export function requireStudent(request: FastifyRequest): CurrentUser & { studentId: string } {
  const user = requireUser(request);
  if (user.role !== "student" || !user.studentId) throw forbidden("This area is for students");
  return user as CurrentUser & { studentId: string };
}

export function queryString(request: FastifyRequest, name: string): string | undefined {
  const value = (request.query as Record<string, unknown>)[name];
  return typeof value === "string" && value !== "" ? value : undefined;
}

export function queryNumber(request: FastifyRequest, name: string): number | undefined {
  const value = Number(queryString(request, name));
  return Number.isFinite(value) ? value : undefined;
}

export const params = (request: FastifyRequest) => request.params as Record<string, string>;

export function noContent(reply: FastifyReply) {
  return reply.code(204).send();
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string =>
  typeof value === "string" && UUID.test(value);
