// GET /api/admin/stats -> the Overview page's data in one call.
//
// Every window buckets by orders.created_at — the moment a checkout started
// — not by when it was later paid. That keeps one order's numbers (checkout
// started, paid, failed, revenue) consistent within a single window instead
// of splitting across two depending on which column you ask. The trade-off:
// a checkout started on the last day of a window and paid after it ends
// still counts as that last day's revenue. For how fast Razorpay checkouts
// resolve, that's the right call. "New customers" and "downloads" follow the
// same convention for consistency, even though paid_at would be the more
// literal answer for those two. Guide page views (page_views_daily) are
// already stored by IST calendar date, so they line up with the same
// window boundaries directly.
import { maskEmail, methodNotAllowed, json, jsonError } from "../../lib/http";
import { requireAccess } from "../../lib/access";
import { trackingStartDate, viewsForPeriod } from "../../lib/page-views";
import {
  istDateDaysAgo,
  istDaysBetween,
  isIstDateString,
  shiftIstDateString,
  IST_OFFSET_SQL_MODIFIER,
} from "../../lib/ist";
import type { WorkerEnv } from "../../lib/env";

type RangeKey = "today" | "7d" | "30d" | "all" | "custom";
const RANGE_KEYS: RangeKey[] = ["today", "7d", "30d", "all", "custom"];

interface Period {
  startDate: string | null;
  endDate: string;
}

function resolveRange(url: URL): { key: RangeKey; period: Period } | null {
  const rangeParam = url.searchParams.get("range") ?? "7d";
  if (!RANGE_KEYS.includes(rangeParam as RangeKey)) return null;
  const key = rangeParam as RangeKey;

  if (key === "custom") {
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");
    if (!isIstDateString(start) || !isIstDateString(end)) return null;
    if (end < start) return null;
    return { key, period: { startDate: start, endDate: end } };
  }

  const endDate = istDateDaysAgo(0);
  if (key === "today") return { key, period: { startDate: endDate, endDate } };
  if (key === "7d") return { key, period: { startDate: istDateDaysAgo(6), endDate } };
  if (key === "30d") return { key, period: { startDate: istDateDaysAgo(29), endDate } };
  return { key, period: { startDate: null, endDate } };
}

/** Equal-length period immediately before `period`, or null when it's open-ended ("all"). */
function previousPeriod(period: Period): Period | null {
  if (period.startDate === null) return null;
  const lengthDays = istDaysBetween(period.startDate, period.endDate) + 1;
  const prevEnd = shiftIstDateString(period.startDate, -1);
  const prevStart = shiftIstDateString(prevEnd, -(lengthDays - 1));
  return { startDate: prevStart, endDate: prevEnd };
}

interface WindowStats {
  startDate: string | null;
  endDate: string;
  revenuePaise: number;
  paidOrders: number;
  checkoutsStarted: number;
  views: number;
  failedPayments: number;
  downloads: number;
  newCustomers: number;
}

interface OrderAggRow {
  checkouts_started: number;
  revenue_paise: number;
  paid_orders: number;
  failed_payments: number;
  downloads: number;
}

interface CustomerAggRow {
  new_customers: number;
}

async function windowStats(
  env: WorkerEnv,
  period: Period,
  guideSlug: string | null,
): Promise<WindowStats> {
  const { startDate, endDate } = period;

  const [orderRow, views, customerRow] = await Promise.all([
    env.DB
      .prepare(
        `SELECT
           COUNT(*) AS checkouts_started,
           COALESCE(SUM(CASE WHEN status = 'paid' THEN amount_paise ELSE 0 END), 0) AS revenue_paise,
           COUNT(CASE WHEN status = 'paid' THEN 1 END) AS paid_orders,
           COUNT(CASE WHEN status = 'failed' THEN 1 END) AS failed_payments,
           COALESCE(SUM(download_count), 0) AS downloads
         FROM orders
         WHERE (?1 IS NULL OR strftime('%Y-%m-%d', created_at, '${IST_OFFSET_SQL_MODIFIER}') >= ?1)
           AND strftime('%Y-%m-%d', created_at, '${IST_OFFSET_SQL_MODIFIER}') <= ?2
           AND (?3 IS NULL OR book_slug = ?3)`,
      )
      .bind(startDate, endDate, guideSlug)
      .first<OrderAggRow>(),
    viewsForPeriod(env, startDate, endDate, guideSlug),
    // "New" = this buyer's earliest-ever paid order falls inside the window.
    // Guide filter narrows which buyers count as "in the window" but first-
    // purchase lookup always looks across all guides — a buyer isn't "new"
    // just because it's their first order *of this guide*.
    env.DB
      .prepare(
        `WITH first_order AS (
           SELECT lower(buyer_email) AS email,
                  MIN(strftime('%Y-%m-%d', created_at, '${IST_OFFSET_SQL_MODIFIER}')) AS first_date
             FROM orders
            WHERE status = 'paid' AND buyer_email IS NOT NULL
            GROUP BY lower(buyer_email)
         ),
         window_buyers AS (
           SELECT DISTINCT lower(buyer_email) AS email
             FROM orders
            WHERE status = 'paid' AND buyer_email IS NOT NULL
              AND (?1 IS NULL OR strftime('%Y-%m-%d', created_at, '${IST_OFFSET_SQL_MODIFIER}') >= ?1)
              AND strftime('%Y-%m-%d', created_at, '${IST_OFFSET_SQL_MODIFIER}') <= ?2
              AND (?3 IS NULL OR book_slug = ?3)
         )
         SELECT
           SUM(CASE WHEN fo.first_date >= COALESCE(?1, '0000-01-01') THEN 1 ELSE 0 END) AS new_customers
         FROM window_buyers wb
         JOIN first_order fo ON fo.email = wb.email`,
      )
      .bind(startDate, endDate, guideSlug)
      .first<CustomerAggRow>(),
  ]);

  return {
    startDate,
    endDate,
    revenuePaise: orderRow?.revenue_paise ?? 0,
    paidOrders: orderRow?.paid_orders ?? 0,
    checkoutsStarted: orderRow?.checkouts_started ?? 0,
    views,
    failedPayments: orderRow?.failed_payments ?? 0,
    downloads: orderRow?.downloads ?? 0,
    newCustomers: customerRow?.new_customers ?? 0,
  };
}

interface PerGuideRow {
  slug: string;
  title: string | null;
  revenue_paise: number;
  paid_orders: number;
  checkouts_started: number;
}

interface PerGuideStats {
  slug: string;
  title: string;
  revenuePaise: number;
  paidOrders: number;
  checkoutsStarted: number;
  conversionRatePercent: number;
}

async function perGuideStats(env: WorkerEnv, period: Period): Promise<PerGuideStats[]> {
  const result = await env.DB
    .prepare(
      `SELECT o.book_slug AS slug, b.title AS title,
              COALESCE(SUM(CASE WHEN o.status = 'paid' THEN o.amount_paise ELSE 0 END), 0) AS revenue_paise,
              COUNT(CASE WHEN o.status = 'paid' THEN 1 END) AS paid_orders,
              COUNT(*) AS checkouts_started
         FROM orders o
         LEFT JOIN books b ON b.slug = o.book_slug
        WHERE (?1 IS NULL OR strftime('%Y-%m-%d', o.created_at, '${IST_OFFSET_SQL_MODIFIER}') >= ?1)
          AND strftime('%Y-%m-%d', o.created_at, '${IST_OFFSET_SQL_MODIFIER}') <= ?2
        GROUP BY o.book_slug, b.title`,
    )
    .bind(period.startDate, period.endDate)
    .all<PerGuideRow>();

  return (result.results ?? []).map((row) => ({
    slug: row.slug,
    title: row.title ?? row.slug,
    revenuePaise: row.revenue_paise,
    paidOrders: row.paid_orders,
    checkoutsStarted: row.checkouts_started,
    conversionRatePercent: row.checkouts_started > 0 ? (row.paid_orders / row.checkouts_started) * 100 : 0,
  }));
}

interface PerGuideFunnelDbRow {
  slug: string;
  title: string | null;
  views: number;
  checkouts_started: number;
  paid: number;
}

interface PerGuideFunnel {
  slug: string;
  title: string;
  views: number;
  checkoutsStarted: number;
  paidOrders: number;
  viewsToCheckoutPercent: number | null;
  checkoutToPaidPercent: number | null;
}

/** One row per guide with any activity (views or checkouts) in `period`. Not filterable by guide — that's a single-row case the caller skips instead. */
async function perGuideFunnel(env: WorkerEnv, period: Period): Promise<PerGuideFunnel[]> {
  const result = await env.DB
    .prepare(
      `WITH v AS (
         SELECT slug, SUM(views) AS views
           FROM page_views_daily
          WHERE (?1 IS NULL OR date >= ?1) AND date <= ?2
          GROUP BY slug
       ),
       o AS (
         SELECT book_slug AS slug,
                COUNT(*) AS checkouts_started,
                COUNT(CASE WHEN status = 'paid' THEN 1 END) AS paid
           FROM orders
          WHERE (?1 IS NULL OR strftime('%Y-%m-%d', created_at, '${IST_OFFSET_SQL_MODIFIER}') >= ?1)
            AND strftime('%Y-%m-%d', created_at, '${IST_OFFSET_SQL_MODIFIER}') <= ?2
          GROUP BY book_slug
       )
       SELECT b.slug AS slug, b.title AS title,
              COALESCE(v.views, 0) AS views,
              COALESCE(o.checkouts_started, 0) AS checkouts_started,
              COALESCE(o.paid, 0) AS paid
         FROM books b
         LEFT JOIN v ON v.slug = b.slug
         LEFT JOIN o ON o.slug = b.slug
        WHERE COALESCE(v.views, 0) > 0 OR COALESCE(o.checkouts_started, 0) > 0
        ORDER BY views DESC, checkouts_started DESC`,
    )
    .bind(period.startDate, period.endDate)
    .all<PerGuideFunnelDbRow>();

  return (result.results ?? []).map((row) => ({
    slug: row.slug,
    title: row.title ?? row.slug,
    views: row.views,
    checkoutsStarted: row.checkouts_started,
    paidOrders: row.paid,
    viewsToCheckoutPercent: row.views > 0 ? (row.checkouts_started / row.views) * 100 : null,
    checkoutToPaidPercent: row.checkouts_started > 0 ? (row.paid / row.checkouts_started) * 100 : null,
  }));
}

interface ChartDayRevenue {
  day: string;
  revenue_paise: number;
}

interface RecentOrderRow {
  created_at: string;
  book_slug: string;
  title: string | null;
  amount_paise: number;
  buyer_email: string | null;
  status: string;
}

export async function handleAdminStats(req: Request, env: WorkerEnv): Promise<Response> {
  if (req.method !== "GET") return methodNotAllowed(req, "GET");

  const access = await requireAccess(req, env);
  if (!access.ok) return access.response;

  const url = new URL(req.url);
  const resolved = resolveRange(url);
  if (!resolved) {
    return jsonError(req, 400, "invalid_request", "range must be today, 7d, 30d, all, or custom (with start/end).");
  }
  const { key, period } = resolved;

  const guideParam = url.searchParams.get("guide");
  const guideSlug = guideParam && guideParam !== "all" ? guideParam : null;

  const prevPeriod = previousPeriod(period);

  try {
    const [current, previous, trackingStart] = await Promise.all([
      windowStats(env, period, guideSlug),
      prevPeriod ? windowStats(env, prevPeriod, guideSlug) : Promise.resolve(null),
      trackingStartDate(env),
    ]);

    const [bestSellers, weakest, perGuideFunnelRows] = guideSlug
      ? [null, null, null]
      : await (async () => {
          const guides = (await perGuideStats(env, period)).filter((g) => g.checkoutsStarted > 0);
          const byRevenue = [...guides].sort((a, b) => b.revenuePaise - a.revenuePaise).slice(0, 5);
          const byConversion = [...guides]
            .sort((a, b) => a.conversionRatePercent - b.conversionRatePercent)
            .slice(0, 5);
          const funnelRows = await perGuideFunnel(env, period);
          return [byRevenue, byConversion, funnelRows];
        })();

    // The big chart always shows the trailing 30 days, independent of the
    // range filter above (a "Today" selection would otherwise draw a
    // single-bar chart) — same window the dashboard has always charted,
    // now also respecting the Guide filter.
    const chartStart = istDateDaysAgo(29);
    const revenueByDay = await env.DB
      .prepare(
        `SELECT strftime('%Y-%m-%d', created_at, '${IST_OFFSET_SQL_MODIFIER}') AS day,
                COALESCE(SUM(amount_paise), 0) AS revenue_paise
           FROM orders
          WHERE status = 'paid'
            AND strftime('%Y-%m-%d', created_at, '${IST_OFFSET_SQL_MODIFIER}') >= ?1
            AND (?2 IS NULL OR book_slug = ?2)
          GROUP BY day`,
      )
      .bind(chartStart, guideSlug)
      .all<ChartDayRevenue>();

    const revenueByDate = new Map((revenueByDay.results ?? []).map((r) => [r.day, r.revenue_paise]));
    const chart = Array.from({ length: 30 }, (_, i) => {
      const date = istDateDaysAgo(29 - i);
      return {
        date,
        revenuePaise: revenueByDate.get(date) ?? 0,
      };
    });

    const recentOrdersResult = await env.DB
      .prepare(
        `SELECT o.created_at AS created_at, o.book_slug AS book_slug, b.title AS title,
                o.amount_paise AS amount_paise, o.buyer_email AS buyer_email, o.status AS status
           FROM orders o
           LEFT JOIN books b ON b.slug = o.book_slug
          WHERE (?1 IS NULL OR strftime('%Y-%m-%d', o.created_at, '${IST_OFFSET_SQL_MODIFIER}') >= ?1)
            AND strftime('%Y-%m-%d', o.created_at, '${IST_OFFSET_SQL_MODIFIER}') <= ?2
            AND (?3 IS NULL OR o.book_slug = ?3)
          ORDER BY o.created_at DESC
          LIMIT 8`,
      )
      .bind(period.startDate, period.endDate, guideSlug)
      .all<RecentOrderRow>();

    return json(req, {
      generatedAt: new Date().toISOString(),
      range: {
        key,
        startDate: period.startDate,
        endDate: period.endDate,
        previousStartDate: prevPeriod?.startDate ?? null,
        previousEndDate: prevPeriod?.endDate ?? null,
      },
      current,
      previous,
      trackingStartDate: trackingStart,
      bestSellers,
      weakest,
      perGuideFunnel: perGuideFunnelRows,
      chart,
      recentOrders: (recentOrdersResult.results ?? []).map((row) => ({
        date: row.created_at,
        guideTitle: row.title ?? row.book_slug,
        amountPaise: row.amount_paise,
        maskedEmail: maskEmail(row.buyer_email),
        status: row.status,
      })),
    });
  } catch (error) {
    console.error("admin/stats: query failed", error);
    return jsonError(req, 500, "server_error", "Could not load stats.");
  }
}
