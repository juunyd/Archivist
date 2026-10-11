// D1 access for the admin Orders list/detail (Phase 4 Step 2). Read-only —
// nothing here ever writes to `orders`. Mirrors the lib/guides-admin.ts
// pattern: query helpers here, requireAccess + serialization in the route.
import type { WorkerEnv } from "./env";
import { IST_OFFSET_SQL_MODIFIER } from "./ist";

export type OrderStatus = "created" | "paid" | "failed" | "refunded";
export type OrderSortKey = "date" | "amount" | "guide" | "status";
export type SortDir = "asc" | "desc";

const SORT_COLUMNS: Record<OrderSortKey, string> = {
  date: "o.created_at",
  amount: "o.amount_paise",
  guide: "COALESCE(b.title, o.book_slug)",
  status: "o.status",
};

export interface ListOrdersParams {
  search: string | null;
  status: OrderStatus | null;
  guideSlug: string | null;
  startDate: string | null; // IST 'YYYY-MM-DD', inclusive
  endDate: string | null; // IST 'YYYY-MM-DD', inclusive
  sort: OrderSortKey;
  dir: SortDir;
  page: number;
  pageSize: number;
}

export interface AdminOrderListRow {
  id: string;
  created_at: string;
  book_slug: string;
  title: string | null;
  amount_paise: number;
  buyer_email: string | null;
  status: string;
}

export interface AdminOrderDetailRow {
  id: string;
  book_slug: string;
  title: string | null;
  amount_paise: number;
  currency: string;
  status: string;
  buyer_email: string | null;
  razorpay_order_id: string;
  razorpay_payment_id: string | null;
  download_count: number;
  created_at: string;
  paid_at: string | null;
  fulfilled_at: string | null;
  email_sent_at: string | null;
}

function buildWhere(params: ListOrdersParams): { clause: string; binds: unknown[] } {
  const conditions: string[] = [];
  const binds: unknown[] = [];

  if (params.status) {
    conditions.push("o.status = ?");
    binds.push(params.status);
  }
  if (params.guideSlug) {
    conditions.push("o.book_slug = ?");
    binds.push(params.guideSlug);
  }
  if (params.startDate) {
    conditions.push(`strftime('%Y-%m-%d', o.created_at, '${IST_OFFSET_SQL_MODIFIER}') >= ?`);
    binds.push(params.startDate);
  }
  if (params.endDate) {
    conditions.push(`strftime('%Y-%m-%d', o.created_at, '${IST_OFFSET_SQL_MODIFIER}') <= ?`);
    binds.push(params.endDate);
  }
  if (params.search) {
    const like = `%${params.search.toLowerCase()}%`;
    conditions.push(
      "(lower(o.buyer_email) LIKE ? OR lower(o.id) LIKE ? OR lower(COALESCE(o.razorpay_payment_id, '')) LIKE ? OR lower(COALESCE(b.title, '')) LIKE ?)",
    );
    binds.push(like, like, like, like);
  }

  return { clause: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "", binds };
}

export async function listAdminOrders(
  env: WorkerEnv,
  params: ListOrdersParams,
): Promise<{ rows: AdminOrderListRow[]; total: number }> {
  const { clause, binds } = buildWhere(params);
  const sortColumn = SORT_COLUMNS[params.sort];
  const dir = params.dir === "asc" ? "ASC" : "DESC";
  const offset = (params.page - 1) * params.pageSize;

  const [rowsResult, countRow] = await Promise.all([
    env.DB
      .prepare(
        `SELECT o.id AS id, o.created_at AS created_at, o.book_slug AS book_slug, b.title AS title,
                o.amount_paise AS amount_paise, o.buyer_email AS buyer_email, o.status AS status
           FROM orders o
           LEFT JOIN books b ON b.slug = o.book_slug
           ${clause}
          ORDER BY ${sortColumn} ${dir}
          LIMIT ? OFFSET ?`,
      )
      .bind(...binds, params.pageSize, offset)
      .all<AdminOrderListRow>(),
    env.DB
      .prepare(
        `SELECT COUNT(*) AS total
           FROM orders o
           LEFT JOIN books b ON b.slug = o.book_slug
           ${clause}`,
      )
      .bind(...binds)
      .first<{ total: number }>(),
  ]);

  return { rows: rowsResult.results ?? [], total: countRow?.total ?? 0 };
}

export async function getAdminOrder(env: WorkerEnv, id: string): Promise<AdminOrderDetailRow | null> {
  return env.DB
    .prepare(
      `SELECT o.id AS id, o.book_slug AS book_slug, b.title AS title,
              o.amount_paise AS amount_paise, o.currency AS currency, o.status AS status,
              o.buyer_email AS buyer_email, o.razorpay_order_id AS razorpay_order_id,
              o.razorpay_payment_id AS razorpay_payment_id, o.download_count AS download_count,
              o.created_at AS created_at, o.paid_at AS paid_at, o.fulfilled_at AS fulfilled_at,
              o.email_sent_at AS email_sent_at
         FROM orders o
         LEFT JOIN books b ON b.slug = o.book_slug
        WHERE o.id = ?1`,
    )
    .bind(id)
    .first<AdminOrderDetailRow>();
}
