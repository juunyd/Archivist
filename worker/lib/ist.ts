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
