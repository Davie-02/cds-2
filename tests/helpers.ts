import type { FastifyInstance, InjectOptions } from "fastify";
import { buildApp, createServices, type Services } from "../src/server/app.js";
import { loadConfig } from "../src/server/config.js";
import { migrate } from "../src/server/db/migrate.js";
import { createPool, type Db } from "../src/server/db/pool.js";
import { hashPassword } from "../src/server/services/passwords.js";
import { ensureOwner, seedDefaultContent } from "../src/server/services/seed.js";

export const OWNER = { email: "owner@test.local", password: "owner-password-1" };

export interface TestContext {
  app: FastifyInstance;
  db: Db;
  services: Services;
}

function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url)
    throw new Error("Set TEST_DATABASE_URL to a disposable Postgres database to run the tests");
  return url;
}

/** Wipes the test database, applies migrations, seeds defaults and returns a ready app. */
export async function setup(): Promise<TestContext> {
  const config = loadConfig({
    NODE_ENV: "test",
    DATABASE_URL: testDatabaseUrl(),
    SESSION_SECRET: "test-secret-test-secret-test-secret-1234",
  });
  const db = createPool(config.DATABASE_URL);
  await db.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await migrate(db);
  await seedDefaultContent(db);
  await ensureOwner(db, { ...OWNER, name: "Owner" });
  const services = createServices(db, config);
  const app = await buildApp(services);
  return { app, db, services };
}

export async function teardown(context: TestContext) {
  await context.app.close();
  await context.db.end();
}

export async function createUser(db: Db, role: string, email: string, password = "password-12345") {
  const { rows } = await db.query<{ id: string }>(
    "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id",
    [`${role} user`, email, await hashPassword(password), role],
  );
  return { id: rows[0]!.id, email, password };
}

export async function login(
  app: FastifyInstance,
  email: string,
  password: string,
): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    headers: { "x-requested-with": "fetch" },
    payload: { email, password },
  });
  if (response.statusCode !== 204) throw new Error(`Login failed for ${email}: ${response.body}`);
  const cookie = response.cookies.find((c) => c.name === "sid");
  return `sid=${cookie!.value}`;
}

/** A signed-in API client for one user. */
export function client(app: FastifyInstance, cookie: string) {
  const send = async (method: InjectOptions["method"], url: string, payload?: unknown) => {
    const response = await app.inject({
      method,
      url,
      headers: { cookie, "x-requested-with": "fetch" },
      payload: payload as InjectOptions["payload"],
    });
    return { status: response.statusCode, body: response.body ? response.json() : undefined };
  };
  return {
    get: (url: string) => send("GET", url),
    post: (url: string, payload: unknown = {}) => send("POST", url, payload),
    patch: (url: string, payload: unknown) => send("PATCH", url, payload),
    put: (url: string, payload: unknown) => send("PUT", url, payload),
    delete: (url: string) => send("DELETE", url),
  };
}

export type Client = ReturnType<typeof client>;
