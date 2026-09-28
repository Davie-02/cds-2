import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { Services } from "../app.js";
import { badRequest, unauthorized } from "../errors.js";
import {
  checkCredentials,
  createSession,
  destroySession,
  destroyUserSessions,
} from "../services/auth.js";
import { hashPassword, verifyPassword } from "../services/passwords.js";
import { flattenIssues } from "../../shared/validation.js";
import { noContent, requireUser, SESSION_COOKIE } from "./common.js";

const loginSchema = z.object({ email: z.string().trim().max(254), password: z.string().max(200) });
const passwordSchema = z.object({
  current_password: z.string().max(200),
  new_password: z.string().min(10, "Use at least 10 characters").max(200),
});

export function authRoutes({ db, config }: Services): FastifyPluginAsync {
  return async (app) => {
    const cookieOptions = {
      path: "/",
      httpOnly: true,
      sameSite: "lax" as const,
      secure: config.NODE_ENV === "production",
      signed: true,
      maxAge: config.SESSION_DAYS * 86_400,
    };

    app.post(
      "/login",
      { config: { rateLimit: { max: 10, timeWindow: "15 minutes" } } },
      async (request, reply) => {
        const body = loginSchema.safeParse(request.body);
        if (!body.success) throw badRequest("Enter your email and password");
        const userId = await checkCredentials(db, body.data.email, body.data.password);
        if (!userId) throw badRequest("Email or password is incorrect");
        const token = await createSession(db, userId, config.SESSION_DAYS);
        reply.setCookie(SESSION_COOKIE, token, cookieOptions);
        return noContent(reply);
      },
    );

    app.post("/logout", async (request, reply) => {
      const signed = request.cookies[SESSION_COOKIE];
      const token = signed ? request.unsignCookie(signed) : null;
      if (token?.valid && token.value) await destroySession(db, token.value);
      reply.clearCookie(SESSION_COOKIE, { path: "/" });
      return noContent(reply);
    });

    app.get("/me", async (request) => {
      const user = request.user;
      if (!user) throw unauthorized();
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: [...user.permissions],
        instructor_id: user.instructorId,
        student_id: user.studentId,
      };
    });

    app.post(
      "/password",
      { config: { rateLimit: { max: 10, timeWindow: "15 minutes" } } },
      async (request, reply) => {
        const user = requireUser(request);
        const body = passwordSchema.safeParse(request.body);
        if (!body.success)
          throw badRequest(
            "Please correct the highlighted fields",
            flattenIssues(body.error.issues),
          );
        const { rows } = await db.query("SELECT password_hash FROM users WHERE id = $1", [user.id]);
        if (!(await verifyPassword(body.data.current_password, rows[0].password_hash))) {
          throw badRequest("Current password is incorrect", { current_password: "Incorrect" });
        }
        await db.query("UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1", [
          user.id,
          await hashPassword(body.data.new_password),
        ]);
        await destroyUserSessions(db, user.id);
        const token = await createSession(db, user.id, config.SESSION_DAYS);
        reply.setCookie(SESSION_COOKIE, token, cookieOptions);
        return noContent(reply);
      },
    );
  };
}
