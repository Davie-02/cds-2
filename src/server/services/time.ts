/** Wall-clock parts of an instant in a given IANA time zone. */
export interface LocalParts {
  date: string;
  time: string;
  weekday: number;
  minutes: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let format = formatters.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    });
    formatters.set(timeZone, format);
  }
  return format;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function localParts(instant: Date, timeZone: string): LocalParts {
  const parts = Object.fromEntries(
    formatter(timeZone)
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  const time = `${parts.hour}:${parts.minute}`;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time,
    weekday: WEEKDAY_INDEX[parts.weekday!] ?? 0,
    minutes: timeToMinutes(time),
  };
}

export function timeToMinutes(time: string): number {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Converts a wall-clock date and time in `timeZone` to the matching instant. */
export function zonedToUtc(date: string, time: string, timeZone: string): Date {
  const guess = new Date(`${date}T${time}:00Z`);
  // Two passes settle the offset even when the guess lands on the other side of a DST change.
  let instant = guess;
  for (let i = 0; i < 2; i++) {
    const local = localParts(instant, timeZone);
    const shownAsUtc = Date.parse(`${local.date}T${local.time}:00Z`);
    instant = new Date(instant.getTime() - (shownAsUtc - guess.getTime()));
  }
  return instant;
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function todayIn(timeZone: string, now = new Date()): string {
  return localParts(now, timeZone).date;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone });
    return true;
  } catch {
    return false;
  }
}
