import nodemailer from "nodemailer";
import type { Db } from "../db/pool.js";
import { upcomingReminders } from "./dashboard.js";
import { loadSettings } from "./settings.js";
import { todayIn } from "./time.js";

export interface Mailer {
  send(to: string, subject: string, text: string): Promise<void>;
}

export function createMailer(smtpUrl: string | undefined, from: string | undefined): Mailer | null {
  if (!smtpUrl || !from) return null;
  const transport = nodemailer.createTransport(smtpUrl);
  return {
    async send(to, subject, text) {
      await transport.sendMail({ from, to, subject, text });
    },
  };
}

const LAST_SENT_KEY = "reminder_email_last_sent";

/** Sends the day's reminder digest once per school day, if an address is configured. */
export async function sendDailyReminders(
  db: Db,
  mailer: Mailer,
  now = new Date(),
): Promise<boolean> {
  const settings = await loadSettings(db);
  const to = settings.reminders.reminder_email;
  if (!to) return false;
  const today = todayIn(String(settings.booking.timezone), now);

  const { rows } = await db.query("SELECT value FROM meta WHERE key = $1", [LAST_SENT_KEY]);
  if (rows[0]?.value === today) return false;

  const reminders = await upcomingReminders(db, today);
  if (reminders.length) {
    const lines = reminders.map(
      (r) => `${r.overdue ? "OVERDUE " : ""}${r.due_on}  ${r.detail}: ${r.subject}`,
    );
    await mailer.send(String(to), `${reminders.length} reminder(s) for ${today}`, lines.join("\n"));
  }
  await db.query(
    `INSERT INTO meta (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    [LAST_SENT_KEY, JSON.stringify(today)],
  );
  return reminders.length > 0;
}
