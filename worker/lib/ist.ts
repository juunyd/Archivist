// Every admin stat is reported in IST, because that's the timezone the one
// person reading this dashboard lives in — "today" should mean their today,
// not UTC's.
//
// D1 stores timestamps as UTC ISO strings (see nowIso() in lib/orders.ts).
// Rather than shift every row into IST in JS, SQLite's own date functions do
// it in the query: IST is UTC+5:30 with no DST, so `strftime('%Y-%m-%d', col,
// '+330 minutes')` reads any UTC column as its IST calendar date directly.
export const IST_OFFSET_SQL_MODIFIER = "+330 minutes";
export const IST_TIME_ZONE = "Asia/Kolkata";

/** 'YYYY-MM-DD' for `date` as seen in IST — used to compute window boundaries in JS. */
export function istDateString(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** The IST calendar date `daysAgo` days before today (0 = today). */
export function istDateDaysAgo(daysAgo: number): string {
  // Subtracting whole days in UTC millis and then re-reading in IST is safe —
  // IST has no DST, so a day is always exactly 24h regardless of the offset.
  return istDateString(new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000));
}

const IST_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar date in 'YYYY-MM-DD' form (rejects e.g. 2024-02-30). */
export function isIstDateString(value: unknown): value is string {
  if (typeof value !== "string" || !IST_DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const asDate = new Date(Date.UTC(y, m - 1, d));
  return (
    asDate.getUTCFullYear() === y &&
    asDate.getUTCMonth() === m - 1 &&
    asDate.getUTCDate() === d
  );
}

/** Days between two 'YYYY-MM-DD' IST date strings (end - start), inclusive-agnostic. */
export function istDaysBetween(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  return Math.round((end - start) / (24 * 60 * 60 * 1000));
}

/** `date` shifted by `days` (negative = earlier), as an IST 'YYYY-MM-DD' string. */
export function shiftIstDateString(date: string, days: number): string {
  const asDate = new Date(`${date}T00:00:00Z`);
  asDate.setUTCDate(asDate.getUTCDate() + days);
  return asDate.toISOString().slice(0, 10);
}
