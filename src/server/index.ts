import { buildApp, createServices } from "./app.js";
import { loadConfig } from "./config.js";
import { migrate } from "./db/migrate.js";
import { createPool } from "./db/pool.js";
import { purgeExpiredSessions } from "./services/auth.js";
import { createMailer, sendDailyReminders } from "./services/mailer.js";
import { ensureOwner, seedDefaultContent } from "./services/seed.js";

const HOUR = 3_600_000;

const config = loadConfig();
const db = createPool(config.DATABASE_URL, config.DATABASE_SSL);

await migrate(db);
await seedDefaultContent(db);
const owner = await ensureOwner(db, {
  email: config.OWNER_EMAIL,
  password: config.OWNER_PASSWORD,
  name: config.OWNER_NAME,
});

const app = await buildApp(createServices(db, config));
if (owner === "missing-config") {
  app.log.warn(
    "No owner account exists. Set OWNER_EMAIL and OWNER_PASSWORD and restart to create one.",
  );
}

const mailer = createMailer(config.SMTP_URL, config.MAIL_FROM);
const hourlyJobs = setInterval(() => {
  purgeExpiredSessions(db).catch((error) => app.log.error(error));
  if (mailer) sendDailyReminders(db, mailer).catch((error) => app.log.error(error));
}, HOUR);

async function shutdown() {
  clearInterval(hourlyJobs);
  await app.close();
  await db.end();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

await app.listen({ port: config.PORT, host: config.HOST });
