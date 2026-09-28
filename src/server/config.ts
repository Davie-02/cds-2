import { z } from "zod";

const booleanFlag = z
  .enum(["true", "false", "1", "0"])
  .optional()
  .transform((value) => value === "true" || value === "1");

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default("0.0.0.0"),
  PUBLIC_URL: z.url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DATABASE_SSL: booleanFlag,
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  SESSION_DAYS: z.coerce.number().int().positive().default(14),
  OWNER_EMAIL: z.email().optional(),
  OWNER_PASSWORD: z.string().min(10).optional(),
  OWNER_NAME: z.string().default("Owner"),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(25),
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().optional(),
  TRUST_PROXY: booleanFlag,
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = schema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues.map(
      (issue) => `  ${issue.path.join(".")}: ${issue.message}`,
    );
    throw new Error(`Invalid environment configuration:\n${problems.join("\n")}`);
  }
  return result.data;
}
