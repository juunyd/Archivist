// D1 access for the admin Customers page and the Emails page's two lists
// (Phase 4 Step 3). Read-only throughout — nothing here writes to `orders`.
import type { WorkerEnv } from "./env";

export type CustomerSortKey = "email" | "orders" | "spent" | "first" | "last";
export type AbandonedSortKey = "email" | "attempts" | "last";
export type SortDir = "asc" | "desc";

const CUSTOMER_SORT_COLUMNS: Record<CustomerSortKey, string> = {
  email: "email_key",
  orders: "orders_count",
  spent: "total_spent_paise",
  first: "first_purchase_at",
  last: "last_purchase_at",
};

const ABANDONED_SORT_COLUMNS: Record<AbandonedSortKey, string> = {
  email: "email_key",
  attempts: "attempts_count",
  last: "last_attempt_at",
};

export interface CustomerListRow {
  email_key: string;
  email: string;
  orders_count: number;
  total_spent_paise: number;
  first_purchase_at: string;
  last_purchase_at: string;
  guides_count: number;
}

export interface ListCustomersParams {
  search: string | null;
  sort: CustomerSortKey;
  dir: SortDir;
  page: number;
  pageSize: number;
  all?: boolean; // skip LIMIT/OFFSET — used for CSV export
}

export async function listCustomers(
  env: WorkerEnv,
  params: ListCustomersParams,
): Promise<{ rows: CustomerListRow[]; total: number }> {
  const conditions = ["o.status = 'paid'", "o.buyer_email IS NOT NULL"];
  const binds: unknown[] = [];
  if (params.search) {
    conditions.push("lower(o.buyer_email) LIKE ?");
    binds.push(`%${params.search.toLowerCase()}%`);
  }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const sortColumn = CUSTOMER_SORT_COLUMNS[params.sort];
  const dir = params.dir === "asc" ? "ASC" : "DESC";
  const limitClause = params.all ? "" : "LIMIT ? OFFSET ?";
  const limitBinds = params.all ? [] : [params.pageSize, (params.page - 1) * params.pageSize];

  const [rowsResult, countRow] = await Promise.all([
    env.DB
      .prepare(
        `SELECT lower(o.buyer_email) AS email_key,
                MAX(o.buyer_email) AS email,
                COUNT(*) AS orders_count,
                SUM(o.amount_paise) AS total_spent_paise,
                MIN(o.created_at) AS first_purchase_at,
                MAX(o.created_at) AS last_purchase_at,
                COUNT(DISTINCT o.book_slug) AS guides_count
           FROM orders o
           ${where}
          GROUP BY lower(o.buyer_email)
          ORDER BY ${sortColumn} ${dir}
          ${limitClause}`,
      )
      .bind(...binds, ...limitBinds)
      .all<CustomerListRow>(),
    env.DB
      .prepare(
        `SELECT COUNT(*) AS total FROM (
           SELECT 1 FROM orders o ${where} GROUP BY lower(o.buyer_email)
         )`,
      )
      .bind(...binds)
      .first<{ total: number }>(),
  ]);

  return { rows: rowsResult.results ?? [], total: countRow?.total ?? 0 };
}

export interface CustomerOrderRow {
  id: string;
  created_at: string;
  book_slug: string;
  title: string | null;
  amount_paise: number;
  status: string;
}

/** Every order (any status) for one email, newest first — null if the email has none. */
export async function getCustomerOrders(env: WorkerEnv, email: string): Promise<CustomerOrderRow[]> {
  const result = await env.DB
    .prepare(
      `SELECT o.id AS id, o.created_at AS created_at, o.book_slug AS book_slug, b.title AS title,
              o.amount_paise AS amount_paise, o.status AS status
         FROM orders o
         LEFT JOIN books b ON b.slug = o.book_slug
        WHERE lower(o.buyer_email) = lower(?1)
        ORDER BY o.created_at DESC`,
    )
    .bind(email)
    .all<CustomerOrderRow>();
  return result.results ?? [];
}

export interface AbandonedListRow {
  email_key: string;
  email: string;
  attempts_count: number;
  last_attempt_at: string;
  last_guide_title: string | null;
}

export interface ListAbandonedParams {
  search: string | null;
  sort: AbandonedSortKey;
  dir: SortDir;
  page: number;
  pageSize: number;
  all?: boolean;
}

/**
 * Emails with a started-or-failed checkout who have NEVER had a paid order —
 * true non-converters, not just someone whose most recent attempt failed.
 * Someone who failed once and later paid shows up in listCustomers(), not
 * here, so the two Emails lists never overlap.
 */
export async function listAbandonedCheckouts(
  env: WorkerEnv,
  params: ListAbandonedParams,
): Promise<{ rows: AbandonedListRow[]; total: number }> {
  const searchBind = params.search ? [`%${params.search.toLowerCase()}%`] : [];
  const searchClause = params.search ? "AND agg.email_key LIKE ?" : "";
  const sortColumn = ABANDONED_SORT_COLUMNS[params.sort];
  const dir = params.dir === "asc" ? "ASC" : "DESC";
  const limitClause = params.all ? "" : "LIMIT ? OFFSET ?";
  const limitBinds = params.all ? [] : [params.pageSize, (params.page - 1) * params.pageSize];

  const baseCte = `
    WITH attempts AS (
      SELECT o.buyer_email AS buyer_email, o.created_at AS created_at, b.title AS title,
             ROW_NUMBER() OVER (PARTITION BY lower(o.buyer_email) ORDER BY o.created_at DESC) AS rn
        FROM orders o
        LEFT JOIN books b ON b.slug = o.book_slug
       WHERE o.buyer_email IS NOT NULL AND o.status IN ('created', 'failed')
    ),
    paid_emails AS (
      SELECT DISTINCT lower(buyer_email) AS email FROM orders WHERE status = 'paid' AND buyer_email IS NOT NULL
    ),
    agg AS (
      SELECT lower(buyer_email) AS email_key, COUNT(*) AS attempts_count, MAX(created_at) AS last_attempt_at
        FROM orders
       WHERE buyer_email IS NOT NULL AND status IN ('created', 'failed')
       GROUP BY lower(buyer_email)
    )
  `;

  const [rowsResult, countRow] = await Promise.all([
    env.DB
      .prepare(
        `${baseCte}
         SELECT agg.email_key AS email_key, a.buyer_email AS email, agg.attempts_count AS attempts_count,
                agg.last_attempt_at AS last_attempt_at, a.title AS last_guide_title
           FROM agg
           JOIN attempts a ON a.rn = 1 AND lower(a.buyer_email) = agg.email_key
          WHERE agg.email_key NOT IN (SELECT email FROM paid_emails)
            ${searchClause}
          ORDER BY ${sortColumn} ${dir}
          ${limitClause}`,
      )
      .bind(...searchBind, ...limitBinds)
      .all<AbandonedListRow>(),
    env.DB
      .prepare(
        `${baseCte}
         SELECT COUNT(*) AS total
           FROM agg
          WHERE agg.email_key NOT IN (SELECT email FROM paid_emails)
            ${searchClause}`,
      )
      .bind(...searchBind)
      .first<{ total: number }>(),
  ]);

  return { rows: rowsResult.results ?? [], total: countRow?.total ?? 0 };
}
