import type { WorkerEnv } from "./env";
import { isPaidStatus, type RazorpayPayment } from "./razorpay";

// "Guide" is the product name everywhere a visitor sees it, but D1's table
// is still `books` and `orders.book_slug` — kept as-is on purpose (see
// lib/guides.ts). GuideRow/getGuideBySlug etc. below just wrap that table
// under the name the rest of the app now uses.
export interface GuideRow {
  slug: string;
  title: string;
  price_paise: number;
  currency: string;
  pdf_path: string | null;
  status: "draft" | "published";
}

export interface OrderRow {
  id: string;
  /** D1's `orders.book_slug` column — not renamed, see the note above GuideRow. */
  book_slug: string;
  amount_paise: number;
  currency: string;
  status: "created" | "paid" | "failed" | "refunded";
  razorpay_order_id: string;
  razorpay_payment_id: string | null;
  buyer_email: string | null;
  buyer_phone: string | null;
  download_token: string;
  download_count: number;
  created_at: string;
  paid_at: string | null;
  fulfilled_at: string | null;
  email_sent_at: string | null;
  /** Captured at checkout time (create-order), for the Meta Purchase CAPI event fired later at fulfilment. */
  client_ip: string | null;
  client_user_agent: string | null;
  /** UUID the browser generated for its own Purchase pixel event; reused by the server event so Meta dedupes them. */
  meta_event_id: string | null;
}

const nowIso = () => new Date().toISOString();

export async function getPublishedGuide(env: WorkerEnv, slug: string): Promise<GuideRow | null> {
  return env.DB
    .prepare(
      `SELECT slug, title, price_paise, currency, pdf_path, status
         FROM books
        WHERE slug = ?1 AND status = 'published'`,
    )
    .bind(slug)
    .first<GuideRow>();
}

export async function getGuideBySlug(env: WorkerEnv, slug: string): Promise<GuideRow | null> {
  return env.DB
    .prepare(`SELECT slug, title, price_paise, currency, pdf_path, status FROM books WHERE slug = ?1`)
    .bind(slug)
    .first<GuideRow>();
}

export async function insertOrder(
  env: WorkerEnv,
  input: {
    id: string;
    guideSlug: string;
    amountPaise: number;
    currency: string;
    razorpayOrderId: string;
    downloadToken: string;
    buyerEmail: string | null;
    clientIp: string | null;
    clientUserAgent: string | null;
    metaEventId: string | null;
  },
): Promise<void> {
  await env.DB
    .prepare(
      `INSERT INTO orders
         (id, book_slug, amount_paise, currency, status, razorpay_order_id, buyer_email, download_token,
          client_ip, client_user_agent, meta_event_id)
       VALUES (?1, ?2, ?3, ?4, 'created', ?5, ?6, ?7, ?8, ?9, ?10)`,
    )
    .bind(
      input.id,
      input.guideSlug,
      input.amountPaise,
      input.currency,
      input.razorpayOrderId,
      input.buyerEmail,
      input.downloadToken,
      input.clientIp,
      input.clientUserAgent,
      input.metaEventId,
    )
    .run();
}

export async function findOrderByRazorpayOrderId(
  env: WorkerEnv,
  razorpayOrderId: string,
): Promise<OrderRow | null> {
  return env.DB
    .prepare(`SELECT * FROM orders WHERE razorpay_order_id = ?1`)
    .bind(razorpayOrderId)
    .first<OrderRow>();
}

export async function findOrderById(env: WorkerEnv, orderId: string): Promise<OrderRow | null> {
  return env.DB.prepare(`SELECT * FROM orders WHERE id = ?1`).bind(orderId).first<OrderRow>();
}

export type PaymentCheck =
  | { ok: true }
  | { ok: false; code: string; detail: string };

/**
 * Confirms that what Razorpay says about this payment matches the order we
 * created. A valid signature only proves the message came from Razorpay — it
 * does not prove the amount, currency or order are the ones we asked for.
 * Unchanged from the old Supabase Edge Functions.
 */
export function checkPaymentMatchesOrder(
  order: OrderRow,
  payment: RazorpayPayment,
): PaymentCheck {
  if (!isPaidStatus(payment.status)) {
    return { ok: false, code: "payment_not_captured", detail: `status=${payment.status}` };
  }
  if (payment.order_id !== order.razorpay_order_id) {
    return {
      ok: false,
      code: "order_mismatch",
      detail: `payment.order_id=${payment.order_id} order=${order.razorpay_order_id}`,
    };
  }
  if (payment.amount !== order.amount_paise) {
    return {
      ok: false,
      code: "amount_mismatch",
      detail: `paid=${payment.amount} expected=${order.amount_paise}`,
    };
  }
  if (payment.currency !== order.currency) {
    return {
      ok: false,
      code: "currency_mismatch",
      detail: `paid=${payment.currency} expected=${order.currency}`,
    };
  }
  return { ok: true };
}

/**
 * Moves an order to paid, once. The `status = 'created'` predicate makes this
 * a no-op for whichever of verify / webhook arrives second, so buyer details
 * are never overwritten and paid_at keeps the first timestamp.
 *
 * Razorpay's email wins when it has one, since that is the address the buyer
 * confirmed at the payment step. When it has none, the address captured before
 * checkout stays put (COALESCE) rather than being blanked — that address is
 * the only way to deliver the guide.
 */
export async function markOrderPaid(
  env: WorkerEnv,
  input: { orderId: string; paymentId: string; email: string | null; phone: string | null },
): Promise<{ changed: boolean }> {
  const row = await env.DB
    .prepare(
      `UPDATE orders
          SET status = 'paid',
              razorpay_payment_id = ?2,
              paid_at = ?3,
              buyer_email = COALESCE(?4, buyer_email),
              buyer_phone = COALESCE(?5, buyer_phone)
        WHERE id = ?1
          AND status = 'created'
        RETURNING id`,
    )
    .bind(input.orderId, input.paymentId, nowIso(), input.email, input.phone)
    .first<{ id: string }>();

  return { changed: Boolean(row) };
}

/** Only a still-open order can fail; a paid order stays paid. */
export async function markOrderFailed(env: WorkerEnv, orderId: string): Promise<void> {
  await env.DB
    .prepare(`UPDATE orders SET status = 'failed' WHERE id = ?1 AND status = 'created'`)
    .bind(orderId)
    .run();
}

export interface DownloadClaim {
  order_id: string;
  book_slug: string;
  download_count: number;
}

/**
 * Atomically spends one download against an order. Doing this as
 * read-then-write from the route would let two concurrent clicks both read
 * count = 9 and both proceed; a single UPDATE ... RETURNING with the limit in
 * the WHERE clause makes the check and the increment one indivisible step, so
 * the eleventh attempt always loses. Ports the old claim_download() Postgres
 * function — D1 has no stored procedures, so this lives in the route's own
 * SQL instead of a function in the schema.
 */
export async function claimDownload(
  env: WorkerEnv,
  token: string,
  limit: number,
): Promise<DownloadClaim | null> {
  return env.DB
    .prepare(
      `UPDATE orders
          SET download_count = download_count + 1
        WHERE download_token = ?1
          AND status = 'paid'
          AND download_count < ?2
        RETURNING id AS order_id, book_slug, download_count`,
    )
    .bind(token, limit)
    .first<DownloadClaim>();
}

export interface PurchasedGuide {
  book_slug: string;
  guide_title: string;
  download_token: string;
}

/**
 * Looks up what an address has bought, one row per guide (the newest paid
 * order for each). SQLite has no DISTINCT ON, so this uses ROW_NUMBER()
 * partitioned by book_slug instead — same result as the old Postgres
 * function. Matching happens on lower(buyer_email) so an address containing
 * % or _ cannot turn into a wildcard that returns somebody else's orders
 * (D1's `?` binding is a parameter, never interpolated into the query, so
 * this was never actually exploitable, but the lower() match itself is kept
 * for parity with the old, audited behaviour).
 */
export async function paidOrdersForEmail(env: WorkerEnv, email: string): Promise<PurchasedGuide[]> {
  const result = await env.DB
    .prepare(
      `SELECT book_slug, guide_title, download_token FROM (
         SELECT o.book_slug AS book_slug,
                b.title AS guide_title,
                o.download_token AS download_token,
                ROW_NUMBER() OVER (
                  PARTITION BY o.book_slug
                  ORDER BY o.paid_at DESC
                ) AS rn
           FROM orders o
           JOIN books b ON b.slug = o.book_slug
          WHERE lower(o.buyer_email) = lower(trim(?1))
            AND o.status = 'paid'
       )
       WHERE rn = 1
       ORDER BY book_slug`,
    )
    .bind(email)
    .all<PurchasedGuide>();

  return result.results ?? [];
}
