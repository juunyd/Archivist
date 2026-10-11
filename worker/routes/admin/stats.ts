// GET /api/admin/stats -> the entire admin dashboard's data in one call.
//
// Every window (today/7d/30d/all time) buckets by orders.created_at — the
// moment a checkout started — not by when it was later paid. That keeps one
// order's numbers (checkout started, paid, failed, revenue) consistent within
// a single window instead of splitting across two depending on which column
// you ask. The trade-off: a checkout started on day 29 of a 30-day window and
// paid today still counts as day 29's revenue, not today's. For how fast
// Razorpay checkouts resolve, that's the right call.
import { maskEmail, methodNotAllowed, json, jsonError } from "../../lib/http";
import { requireAccess } from "../../lib/access";
import { feeAssumptions, netOfPaymentFees } from "../../lib/fees";
import { istDateDaysAgo, IST_OFFSET_SQL_MODIFIER } from "../../lib/ist";
import type { WorkerEnv } from "../../lib/env";

interface WindowRow {
  checkouts_started: number;
  revenue_paise: number;
  paid_orders: number;
  failed_payments: number;
}

interface WindowStats {
  label: string;
  startDate: string | null;
  revenuePaise: number;
  paidOrders: number;
  checkoutsStarted: number;
  failedPayments: number;
  conversionRatePercent: number;
  adSpendPaise: number;
  costPerPurchasePaise: number | null;
  roas: number | null;
  estimatedProfitPerSalePaise: number | null;
}

async function windowStats(
  env: WorkerEnv,
  label: string,
  startDate: string | null,
): Promise<WindowStats> {
  const [orderRow, spendRow] = await Promise.all([
    env.DB
      .prepare(
        `SELECT
           COUNT(*) AS checkouts_started,
           COALESCE(SUM(CASE WHEN status = 'paid' THEN amount_paise ELSE 0 END), 0) AS revenue_paise,
           COUNT(CASE WHEN status = 'paid' THEN 1 END) AS paid_orders,
           COUNT(CASE WHEN status = 'failed' THEN 1 END) AS failed_payments
         FROM orders
         WHERE (?1 IS NULL OR strftime('%Y-%m-%d', created_at, '${IST_OFFSET_SQL_MODIFIER}') >= ?1)`,
      )
      .bind(startDate)
      .first<WindowRow>(),
    env.DB
      .prepare(
        `SELECT COALESCE(SUM(amount_paise), 0) AS spend_paise
           FROM daily_ad_spend
          WHERE (?1 IS NULL OR date >= ?1)`,
      )
      .bind(startDate)
      .first<{ spend_paise: number }>(),
  ]);

  const checkoutsStarted = orderRow?.checkouts_started ?? 0;
  const revenuePaise = orderRow?.revenue_paise ?? 0;
  const paidOrders = orderRow?.paid_orders ?? 0;
  const failedPayments = orderRow?.failed_payments ?? 0;
  const adSpendPaise = spendRow?.spend_paise ?? 0;

  const avgSalePaise = paidOrders > 0 ? revenuePaise / paidOrders : 0;
  const costPerPurchasePaise = paidOrders > 0 ? adSpendPaise / paidOrders : null;
  const roas = adSpendPaise > 0 ? revenuePaise / adSpendPaise : null;
  const estimatedProfitPerSalePaise =
    paidOrders > 0 ? netOfPaymentFees(avgSalePaise) - (costPerPurchasePaise ?? 0) : null;

  return {
    label,
    startDate,
    revenuePaise,
    paidOrders,
    checkoutsStarted,
    failedPayments,
    conversionRatePercent: checkoutsStarted > 0 ? (paidOrders / checkoutsStarted) * 100 : 0,
    adSpendPaise,
    costPerPurchasePaise,
    roas,
    estimatedProfitPerSalePaise,
  };
}

interface PerGuideRow {
  slug: string;
  title: string | null;
  status: string | null;
  revenue_paise: number;
  paid_orders: number;
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

  try {
    const [today, last7, last30, allTime] = await Promise.all([
      windowStats(env, "today", istDateDaysAgo(0)),
      windowStats(env, "last_7_days", istDateDaysAgo(6)),
      windowStats(env, "last_30_days", istDateDaysAgo(29)),
      windowStats(env, "all_time", null),
    ]);

    const perGuideResult = await env.DB
      .prepare(
        `SELECT o.book_slug AS slug, b.title AS title, b.status AS status,
                COALESCE(SUM(o.amount_paise), 0) AS revenue_paise,
                COUNT(*) AS paid_orders
           FROM orders o
           LEFT JOIN books b ON b.slug = o.book_slug
          WHERE o.status = 'paid'
          GROUP BY o.book_slug, b.title, b.status
          ORDER BY revenue_paise DESC`,
      )
      .all<PerGuideRow>();

    const downloadsRow = await env.DB
      .prepare(`SELECT COALESCE(SUM(download_count), 0) AS total FROM orders`)
      .first<{ total: number }>();

    const resendSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const resendRow = await env.DB
      .prepare(`SELECT COUNT(*) AS count FROM resend_requests WHERE requested_at >= ?1`)
      .bind(resendSince)
      .first<{ count: number }>();

    const chartStart = istDateDaysAgo(29);
    const [revenueByDay, spendRows] = await Promise.all([
      env.DB
        .prepare(
          `SELECT strftime('%Y-%m-%d', created_at, '${IST_OFFSET_SQL_MODIFIER}') AS day,
                  COALESCE(SUM(amount_paise), 0) AS revenue_paise
             FROM orders
            WHERE status = 'paid'
              AND strftime('%Y-%m-%d', created_at, '${IST_OFFSET_SQL_MODIFIER}') >= ?1
            GROUP BY day`,
        )
        .bind(chartStart)
        .all<ChartDayRevenue>(),
      env.DB
        .prepare(`SELECT date, amount_paise FROM daily_ad_spend WHERE date >= ?1`)
        .bind(chartStart)
        .all<{ date: string; amount_paise: number }>(),
    ]);

    const revenueByDate = new Map((revenueByDay.results ?? []).map((r) => [r.day, r.revenue_paise]));
    const spendByDate = new Map((spendRows.results ?? []).map((r) => [r.date, r.amount_paise]));
    const chart = Array.from({ length: 30 }, (_, i) => {
      const date = istDateDaysAgo(29 - i);
      return {
        date,
        revenuePaise: revenueByDate.get(date) ?? 0,
        spendPaise: spendByDate.get(date) ?? 0,
      };
    });

    const recentOrdersResult = await env.DB
      .prepare(
        `SELECT o.created_at AS created_at, o.book_slug AS book_slug, b.title AS title,
                o.amount_paise AS amount_paise, o.buyer_email AS buyer_email, o.status AS status
           FROM orders o
           LEFT JOIN books b ON b.slug = o.book_slug
          ORDER BY o.created_at DESC
          LIMIT 20`,
      )
      .all<RecentOrderRow>();

    return json(req, {
      generatedAt: new Date().toISOString(),
      feeAssumptions,
      windows: { today, last7, last30, allTime },
      perGuide: (perGuideResult.results ?? []).map((row) => ({
        slug: row.slug,
        title: row.title ?? row.slug,
        status: row.status,
        revenuePaise: row.revenue_paise,
        paidOrders: row.paid_orders,
      })),
      downloads: { total: downloadsRow?.total ?? 0 },
      resendRequests: { last7Days: resendRow?.count ?? 0 },
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
