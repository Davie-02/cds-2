import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import fastifyStatic from "@fastify/static";
import type { Services } from "../app.js";
import { isUuid, params } from "./common.js";
import { notFound } from "../errors.js";

/** Both src/server/routes and dist/server/routes sit three levels below the project root. */
export const PROJECT_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const PUBLIC_DIR = join(PROJECT_ROOT, "public");
const ADMIN_DIR = join(PROJECT_ROOT, "dist", "admin");

export function staticRoutes({ uploads }: Services): FastifyPluginAsync {
  return async (app) => {
    await app.register(fastifyStatic, {
      root: PUBLIC_DIR,
      prefix: "/",
      wildcard: false,
      index: false,
      maxAge: "1h",
      allowedPath: (path) => /^\/(css|js|images)\//.test(path),
    });

    if (existsSync(ADMIN_DIR)) {
      await app.register(fastifyStatic, {
        root: ADMIN_DIR,
        prefix: "/app/",
        decorateReply: false,
        immutable: true,
        maxAge: "365d",
      });
    }

    const appShell = (file: string) => async (_request: unknown, reply: FastifyReply) => {
      const path = join(ADMIN_DIR, file);
      if (!existsSync(path)) {
        return reply
          .code(503)
          .type("text/plain")
          .send("The admin app has not been built yet. Run: npm run build");
      }
      return reply
        .type("text/html")
        .header("Cache-Control", "no-cache")
        .send(await readFile(path));
    };
    for (const [prefix, file] of [
      ["/admin", "admin.html"],
      ["/portal", "portal.html"],
    ] as const) {
      app.get(prefix, appShell(file));
      app.get(`${prefix}/*`, appShell(file));
    }

    app.get("/uploads/:id/:name", async (request, reply) => {
      const { id } = params(request);
      if (!isUuid(id)) throw notFound("File");
      const file = await uploads.read(id, request.user);
      return reply
        .type(file.mime_type)
        .header(
          "Cache-Control",
          file.is_private ? "private, no-store" : "public, max-age=31536000, immutable",
        )
        .header("Content-Disposition", `inline; filename="${file.filename}"`)
        .send(file.data);
    });
  };
}
