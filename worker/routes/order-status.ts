// GET /api/order-status?order_id=<uuid> -> { status, maskedEmail, bookTitle, downloadUrl? }
//
// The thank-you page polls this with nothing but an order id, so it returns
// the bare minimum: no amount, no payment id, no full email address.
//
// downloadUrl is included only once the order is paid, so the buyer can get
// their book straight from the confirmation page instead of waiting on email.
// That does make the order id in the thank-you URL a credential for the
// download — it is a v4 uuid, unguessable and never shown to anyone but the
// buyer, but it is worth knowing that forwarding that URL shares the book.
// Ports supabase/functions/order-status/index.ts.
import { isUuid, json, jsonError, maskEmail, methodNotAllowed } from "../lib/http";
import { downloadUrlFor } from "../lib/links";
import type { WorkerEnv } from "../lib/env";

interface OrderStatusRow {
  status: string;
  buyer_email: string | null;
  download_token: string;
  book_title: string | null;
}

export async function handleOrderStatus(req: Request, env: WorkerEnv): Promise<Response> {
  if (req.method !== "GET") return methodNotAllowed(req, "GET");

  const orderId = new URL(req.url).searchParams.get("order_id");
  if (!isUuid(orderId)) {
    return jsonError(req, 400, "invalid_request", "A valid order id is required.");
  }

  let data: OrderStatusRow | null;
  try {
    data = await env.DB
      .prepare(
        `SELECT o.status AS status,
                o.buyer_email AS buyer_email,
                o.download_token AS download_token,
                b.title AS book_title
           FROM orders o
           LEFT JOIN books b ON b.slug = o.book_slug
          WHERE o.id = ?1`,
      )
      .bind(orderId)
      .first<OrderStatusRow>();
  } catch (error) {
    console.error("order-status: lookup failed", error);
    return jsonError(req, 500, "server_error", "Could not look up that order.");
  }

  if (!data) {
    return jsonError(req, 404, "order_not_found", "We could not find that order.");
  }

  return json(req, {
    status: data.status,
    maskedEmail: maskEmail(data.buyer_email),
    bookTitle: data.book_title,
    downloadUrl: data.status === "paid" ? downloadUrlFor(env, data.download_token) : null,
  });
}
