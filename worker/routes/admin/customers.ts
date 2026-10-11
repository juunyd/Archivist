// GET /api/admin/customers -> paginated, searchable, sortable customer list
//   (one row per buyer_email with at least one paid order), or ?format=csv
//   for the full unpaginated list as a CSV download.
// GET /api/admin/customers/:email -> one customer's full order history.
//
// Full email addresses are returned here (not masked) — this is one of the
// two pages (the other is Emails) the spec allows that on. Read-only.
import { methodNotAllowed, json, jsonError, isEmail } from "../../lib/http";
import { requireAccess } from "../../lib/access";
import { csvResponse } from "../../lib/csv";
import { getCustomerOrders, listCustomers, type CustomerSortKey, type SortDir } from "../../lib/customers-admin";
import type { WorkerEnv } from "../../lib/env";

const SORT_KEYS: CustomerSortKey[] = ["email", "orders", "spent", "first", "last"];

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

export async function handleAdminCustomersList(req: Request, env: WorkerEnv): Promise<Response> {
  if (req.method !== "GET") return methodNotAllowed(req, "GET");

  const access = await requireAccess(req, env);
  if (!access.ok) return access.response;

  const sp = new URL(req.url).searchParams;

  const sortParam = (sp.get("sort") ?? "last") as CustomerSortKey;
  if (!SORT_KEYS.includes(sortParam)) {
    return jsonError(req, 400, "invalid_request", "sort must be email, orders, spent, first, or last.");
  }
  const dir = sp.get("dir") === "asc" ? "asc" : ("desc" as SortDir);
  const search = sp.get("search")?.trim().slice(0, 200) || null;
  const isCsv = sp.get("format") === "csv";

  try {
    if (isCsv) {
      const { rows } = await listCustomers(env, { search, sort: sortParam, dir, page: 1, pageSize: 0, all: true });
      return csvResponse(
        req,
        "customers.csv",
        ["Email", "Orders", "Total spent (INR)", "First purchase (IST)", "Last purchase (IST)", "Guides bought"],
        rows.map((r) => [
          r.email,
          String(r.orders_count),
          formatRupees(r.total_spent_paise),
          formatIst(r.first_purchase_at),
          formatIst(r.last_purchase_at),
          String(r.guides_count),
        ]),
      );
    }

    const page = Math.max(1, Number.parseInt(sp.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(sp.get("pageSize") ?? "20", 10) || 20));

    const { rows, total } = await listCustomers(env, { search, sort: sortParam, dir, page, pageSize });
    return json(req, {
      customers: rows.map((r) => ({
        email: r.email,
        ordersCount: r.orders_count,
        totalSpentPaise: r.total_spent_paise,
        firstPurchaseAt: r.first_purchase_at,
        lastPurchaseAt: r.last_purchase_at,
        guidesCount: r.guides_count,
      })),
      total,
      page,
      pageSize,
    });
  } catch (error) {
    console.error("admin/customers: list failed", error);
    return jsonError(req, 500, "server_error", "Could not load customers.");
  }
}

export async function handleAdminCustomerDetail(req: Request, env: WorkerEnv, email: string): Promise<Response> {
  if (req.method !== "GET") return methodNotAllowed(req, "GET");

  const access = await requireAccess(req, env);
  if (!access.ok) return access.response;

  if (!isEmail(email)) {
    return jsonError(req, 404, "not_found", "No customer with that email.");
  }

  try {
    const orders = await getCustomerOrders(env, email);
    if (orders.length === 0) {
      return jsonError(req, 404, "not_found", "No orders for that email.");
    }

    const paidOrders = orders.filter((o) => o.status === "paid");
    const totalSpentPaise = paidOrders.reduce((sum, o) => sum + o.amount_paise, 0);
    const paidDates = paidOrders.map((o) => o.created_at).sort();

    return json(req, {
      email,
      summary: {
        ordersCount: paidOrders.length,
        totalSpentPaise,
        firstPurchaseAt: paidDates[0] ?? null,
        lastPurchaseAt: paidDates[paidDates.length - 1] ?? null,
      },
      orders: orders.map((o) => ({
        id: o.id,
        date: o.created_at,
        guideTitle: o.title ?? o.book_slug,
        amountPaise: o.amount_paise,
        status: o.status,
      })),
    });
  } catch (error) {
    console.error("admin/customers: detail failed", error);
    return jsonError(req, 500, "server_error", "Could not load customer.");
  }
}
