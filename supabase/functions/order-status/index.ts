// GET ?order_id=<uuid> -> { status, maskedEmail, bookTitle, downloadUrl? }
//
// The thank-you page polls this with nothing but an order id, so it returns
// the bare minimum: no amount, no payment id, no full email address.
//
// downloadUrl is included only once the order is paid, so the buyer can get
// their book straight from the confirmation page instead of waiting on email.
// That does make the order id in the thank-you URL a credential for the
// download — it is a v4 uuid, unguessable and never shown to anyone but the
// buyer, but it is worth knowing that forwarding that URL shares the book.
import { preflight } from "../_shared/cors.ts";
import { isUuid, json, jsonError, maskEmail, methodNotAllowed } from "../_shared/http.ts";
import { adminClient } from "../_shared/supabase.ts";
import { downloadUrlFor } from "../_shared/links.ts";

Deno.serve(async (req) => {
  const options = preflight(req);
  if (options) return options;
  if (req.method !== "GET") return methodNotAllowed(req, "GET");

  const orderId = new URL(req.url).searchParams.get("order_id");
  if (!isUuid(orderId)) {
    return jsonError(req, 400, "invalid_request", "A valid order id is required.");
  }

  const { data, error } = await adminClient()
    .from("orders")
    .select("status, buyer_email, download_token, books(title)")
    .eq("id", orderId)
    .maybeSingle<{
      status: string;
      buyer_email: string | null;
      download_token: string;
      books: { title: string } | null;
    }>();

  if (error) {
    console.error("order-status: lookup failed", error);
    return jsonError(req, 500, "server_error", "Could not look up that order.");
  }
  if (!data) {
    return jsonError(req, 404, "order_not_found", "We could not find that order.");
  }

  return json(req, {
    status: data.status,
    maskedEmail: maskEmail(data.buyer_email),
    bookTitle: data.books?.title ?? null,
    downloadUrl:
      data.status === "paid" ? downloadUrlFor(data.download_token) : null,
  });
});
