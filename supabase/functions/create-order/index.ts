// POST { slug, email? } -> { orderId, razorpayOrderId, amount, currency, keyId, bookTitle }
//
// The client names a book, and optionally the address to deliver it to. It
// never names a price: the amount comes from the books table and is copied
// onto the order, and every later check compares Razorpay's numbers against
// that stored copy.
import { preflight } from "../_shared/cors.ts";
import { isEmail, isSlug, json, jsonError, methodNotAllowed, readJson } from "../_shared/http.ts";
import { adminClient, type BookRow } from "../_shared/supabase.ts";
import { createRazorpayOrder } from "../_shared/razorpay.ts";
import { requireEnv } from "../_shared/env.ts";

Deno.serve(async (req) => {
  const options = preflight(req);
  if (options) return options;
  if (req.method !== "POST") return methodNotAllowed(req, "POST");

  const body = await readJson<{ slug?: unknown; email?: unknown }>(req);
  if (!body || !isSlug(body.slug)) {
    return jsonError(req, 400, "invalid_request", "A valid book slug is required.");
  }
  const slug = body.slug;

  // Captured before checkout so we can still deliver if Razorpay hands back no
  // address. Optional: an order can be created without one.
  if (body.email !== undefined && body.email !== "" && !isEmail(body.email)) {
    return jsonError(req, 400, "invalid_email", "Enter a valid email address.");
  }
  const buyerEmail = isEmail(body.email) ? body.email.trim().toLowerCase() : null;

  const db = adminClient();
  const { data: book, error: bookError } = await db
    .from("books")
    .select("slug, title, price_paise, currency, active")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle<BookRow>();

  if (bookError) {
    console.error("create-order: book lookup failed", bookError);
    return jsonError(req, 500, "server_error", "Could not start checkout. Please try again.");
  }
  if (!book) {
    // Unknown and inactive slugs are the same answer, so probing tells nobody anything.
    return jsonError(req, 404, "book_unavailable", "That book is not available for purchase.");
  }

  // Our id first, so it can be the Razorpay receipt and travel in the notes.
  const orderId = crypto.randomUUID();

  let razorpayOrder;
  try {
    razorpayOrder = await createRazorpayOrder({
      amountPaise: book.price_paise,
      currency: book.currency,
      receipt: orderId,
      notes: { book_slug: book.slug, order_id: orderId },
    });
  } catch (error) {
    console.error("create-order: Razorpay order creation failed", error);
    return jsonError(req, 502, "payment_provider_error", "Could not reach the payment provider. Please try again.");
  }

  const { error: insertError } = await db.from("orders").insert({
    id: orderId,
    book_slug: book.slug,
    amount_paise: book.price_paise,
    currency: book.currency,
    status: "created",
    razorpay_order_id: razorpayOrder.id,
    buyer_email: buyerEmail,
  });

  if (insertError) {
    // The Razorpay order exists but we have nothing to reconcile it against.
    // Unpaid orders expire on their side; log loudly and refuse to continue.
    console.error(
      `create-order: insert failed for ${orderId} / ${razorpayOrder.id}`,
      insertError,
    );
    return jsonError(req, 500, "server_error", "Could not start checkout. Please try again.");
  }

  return json(req, {
    orderId,
    razorpayOrderId: razorpayOrder.id,
    amount: book.price_paise,
    currency: book.currency,
    keyId: requireEnv("RAZORPAY_KEY_ID"),
    bookTitle: book.title,
  });
});
