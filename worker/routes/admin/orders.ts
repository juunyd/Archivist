// GET /api/admin/orders -> paginated, searchable, sortable order list, or
//   ?format=csv for every matching row (ignoring pagination) as a CSV
//   download.
// GET /api/admin/orders/:id -> one order's full detail.
// Read-only: nothing here writes to `orders` (payment/delivery stays on the
// webhook/verify/download routes — see worker/routes/webhook.ts etc.).
//
// Full (unmasked) email addresses are returned here — this is now the only
// admin page that shows them; everywhere else (e.g. the Overview's recent
// orders) keeps using maskEmail() from lib/http.ts.
import { methodNotAllowed, json, jsonError } from "../../lib/http";
import { requireAccess } from "../../lib/access";
import { isIstDateString } from "../../lib/ist";
import { csvResponse } from "../../lib/csv";
import {
  getAdminOrder,
  listAdminOrders,
  type OrderSortKey,
  type OrderStatus,
  type SortDir,
} from "../../lib/orders-admin";
import type { WorkerEnv } from "../../lib/env";

const ORDER_STATUSES: OrderStatus[] = ["created", "paid", "failed", "refunded"];
const SORT_KEYS: OrderSortKey[] = ["date", "amount", "guide", "status"];
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function formatRupees(paise: number): string {
  return (paise / 100).toFixed(2);
}

function formatIst(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export async function handleAdminOrdersList(req: Request, env: WorkerEnv): Promise<Response> {
  if (req.method !== "GET") return methodNotAllowed(req, "GET");

  const access = await requireAccess(req, env);
  if (!access.ok) return access.response;

  const url = new URL(req.url);
  const sp = url.searchParams;

  const statusParam = sp.get("status");
  if (statusParam && !ORDER_STATUSES.includes(statusParam as OrderStatus)) {
    return jsonError(req, 400, "invalid_request", "status must be created, paid, failed, or refunded.");
  }

  const guideParam = sp.get("guide");
  if (guideParam && !SLUG_RE.test(guideParam)) {
    return jsonError(req, 400, "invalid_request", "guide must be a valid slug.");
  }

  const startParam = sp.get("start");
  if (startParam && !isIstDateString(startParam)) {
    return jsonError(req, 400, "invalid_request", "start must be a valid date (YYYY-MM-DD).");
  }
  const endParam = sp.get("end");
  if (endParam && !isIstDateString(endParam)) {
    return jsonError(req, 400, "invalid_request", "end must be a valid date (YYYY-MM-DD).");
  }

  const sortParam = (sp.get("sort") ?? "date") as OrderSortKey;
  if (!SORT_KEYS.includes(sortParam)) {
    return jsonError(req, 400, "invalid_request", "sort must be date, amount, guide, or status.");
  }
  const dirParam = sp.get("dir") === "asc" ? "asc" : ("desc" as SortDir);

  const page = Math.max(1, Number.parseInt(sp.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(sp.get("pageSize") ?? "20", 10) || 20));

  const search = sp.get("search")?.trim().slice(0, 200) || null;
  const isCsv = sp.get("format") === "csv";

  const baseParams = {
    search,
    status: (statusParam as OrderStatus) || null,
    guideSlug: guideParam || null,
    startDate: startParam || null,
    endDate: endParam || null,
    sort: sortParam,
    dir: dirParam,
  };

  try {
    if (isCsv) {
      const { rows } = await listAdminOrders(env, { ...baseParams, page: 1, pageSize: 0, all: true });
      return csvResponse(
        req,
        "orders.csv",
        ["Date", "Guide", "Amount (INR)", "Status", "Email", "Order ID"],
        rows.map((row) => [
          formatIst(row.created_at),
          row.title ?? row.book_slug,
          formatRupees(row.amount_paise),
          row.status,
          row.buyer_email ?? "",
          row.id,
        ]),
      );
    }

    const { rows, total } = await listAdminOrders(env, { ...baseParams, page, pageSize });

    return json(req, {
      orders: rows.map((row) => ({
        id: row.id,
        date: row.created_at,
        guideTitle: row.title ?? row.book_slug,
        guideSlug: row.book_slug,
        amountPaise: row.amount_paise,
        email: row.buyer_email,
        status: row.status,
      })),
      total,
      page,
      pageSize,
    });
  } catch (error) {
    console.error("admin/orders: list failed", error);
    return jsonError(req, 500, "server_error", "Could not load orders.");
  }
}

export async function handleAdminOrderDetail(req: Request, env: WorkerEnv, id: string): Promise<Response> {
  if (req.method !== "GET") return methodNotAllowed(req, "GET");

  const access = await requireAccess(req, env);
  if (!access.ok) return access.response;

  if (!UUID_RE.test(id)) {
    return jsonError(req, 404, "not_found", "No order with that id.");
  }

  try {
    const row = await getAdminOrder(env, id);
    if (!row) return jsonError(req, 404, "not_found", "No order with that id.");

    return json(req, {
      order: {
        id: row.id,
        guideTitle: row.title ?? row.book_slug,
        guideSlug: row.book_slug,
        amountPaise: row.amount_paise,
        currency: row.currency,
        status: row.status,
        email: row.buyer_email,
        razorpayOrderId: row.razorpay_order_id,
        razorpayPaymentId: row.razorpay_payment_id,
        downloadCount: row.download_count,
        createdAt: row.created_at,
        paidAt: row.paid_at,
        fulfilledAt: row.fulfilled_at,
        emailSentAt: row.email_sent_at,
      },
    });
  } catch (error) {
    console.error("admin/orders: detail failed", error);
    return jsonError(req, 500, "server_error", "Could not load order.");
  }
}
