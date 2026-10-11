// page_views_daily: a privacy-safe, per-day/per-guide view counter. No
// cookies, no IP, no buyer identity ever touches this file — just a slug and
// an IST calendar date.
import { istDateDaysAgo } from "./ist";
import type { WorkerEnv } from "./env";

// Matches common crawlers/bots and plain HTTP clients by User-Agent, case-
// insensitively. Deliberately broad (false positives just mean an edge-case
// real visitor isn't counted, which is the safe direction to err in for a
// marketing metric) rather than narrow (which would risk inflating view
// counts with scraper/monitoring traffic).
const BOT_UA_RE =
  /bot|crawl|spider|slurp|facebookexternalhit|meta-externalagent|headlesschrome|phantomjs|puppeteer|playwright|lighthouse|pagespeed|ahrefsbot|semrushbot|mj12bot|dotbot|petalbot|bytespider|yandexbot|baiduspider|duckduckbot|applebot|curl|wget|python-requests|python-urllib|go-http-client|okhttp|libwww-perl|node-fetch|axios|postmanruntime/i;

/** True for an empty/missing User-Agent or one that looks like a bot/script, not a browser. */
export function isBotUserAgent(userAgent: string | null): boolean {
  if (!userAgent || !userAgent.trim()) return true;
  return BOT_UA_RE.test(userAgent);
}

/** +1 to today's (IST) view count for `slug`. Meant to be called via ctx.waitUntil — never awaited by the response. */
export async function recordPageView(env: WorkerEnv, slug: string): Promise<void> {
  const today = istDateDaysAgo(0);
  await env.DB
    .prepare(
      `INSERT INTO page_views_daily (date, slug, views)
       VALUES (?1, ?2, 1)
       ON CONFLICT (date, slug) DO UPDATE SET views = views + 1`,
    )
    .bind(today, slug)
    .run();
}

interface ViewsRow {
  views: number;
}

/** Total views for `guideSlug` (or every guide, when null) within [startDate, endDate]. */
export async function viewsForPeriod(
  env: WorkerEnv,
  startDate: string | null,
  endDate: string,
  guideSlug: string | null,
): Promise<number> {
  const row = await env.DB
    .prepare(
      `SELECT COALESCE(SUM(views), 0) AS views
         FROM page_views_daily
        WHERE (?1 IS NULL OR date >= ?1) AND date <= ?2
          AND (?3 IS NULL OR slug = ?3)`,
    )
    .bind(startDate, endDate, guideSlug)
    .first<ViewsRow>();
  return row?.views ?? 0;
}

interface MinDateRow {
  min_date: string | null;
}

/** The IST date of the earliest view ever recorded, or null if tracking has never run. */
export async function trackingStartDate(env: WorkerEnv): Promise<string | null> {
  const row = await env.DB.prepare(`SELECT MIN(date) AS min_date FROM page_views_daily`).first<MinDateRow>();
  return row?.min_date ?? null;
}
