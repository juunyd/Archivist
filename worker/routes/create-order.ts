// POST /api/create-order  { slug, email? } -> { orderId, razorpayOrderId, amount, currency, keyId, guideTitle }
//
// The client names a guide, and optionally the address to deliver it to. It
// never names a price: the amount comes from the books table and is copied
// onto the order, and every later check compares Razorpay's numbers against
// that stored copy. Ports the old Supabase Edge Functions.
import { isEmail, isSlug, json, jsonError, methodNotAllowed, readJson } from "../lib/http";
import { getPublishedGuide, insertOrder } from "../lib/orders";
import { createRazorpayOrder } from "../lib/razorpay";
import { requireEnv, type WorkerEnv } from "../lib/env";

export async function handleCreateOrder(req: Request, env: WorkerEnv): Promise<Response> {
  if (req.method !== "POST") return methodNotAllowed(req, "POST");

  const body = await readJson<{ slug?: unknown; email?: unknown }>(req);
  if (!body || !isSlug(body.slug)) {
    return jsonError(req, 400, "invalid_request", "A valid guide slug is required.");
  }
  const slug = body.slug;

  // Captured before checkout so we can still deliver if Razorpay hands back no
  // address. Optional: an order can be created without one.
  if (body.email !== undefined && body.email !== "" && !isEmail(body.email)) {
    return jsonError(req, 400, "invalid_email", "Enter a valid email address.");
  }
  const buyerEmail = isEmail(body.email) ? body.email.trim().toLowerCase() : null;

  // Draft guides are not for sale, whatever the client asks for.
  let guide;
  try {
    guide = await getPublishedGuide(env, slug);
  } catch (error) {
    console.error("create-order: guide lookup failed", error);
    return jsonError(req, 500, "server_error", "Could not start checkout. Please try again.");
  }
  if (!guide) {
    // Unknown and draft slugs are the same answer, so probing tells nobody anything.
    return jsonError(req, 404, "guide_unavailable", "That guide is not available for purchase.");
  }

  // Our id first, so it can be the Razorpay receipt and travel in the notes.
  const orderId = crypto.randomUUID();

  let razorpayOrder;
  try {
    razorpayOrder = await createRazorpayOrder(env, {
      amountPaise: guide.price_paise,
      currency: guide.currency,
      receipt: orderId,
      notes: { guide_slug: guide.slug, order_id: orderId },
    });
  } catch (error) {
    console.error("create-order: Razorpay order creation failed", error);
    return jsonError(req, 502, "payment_provider_error", "Could not reach the payment provider. Please try again.");
  }

  try {
    await insertOrder(env, {
      id: orderId,
      guideSlug: guide.slug,
      amountPaise: guide.price_paise,
      currency: guide.currency,
      razorpayOrderId: razorpayOrder.id,
      downloadToken: crypto.randomUUID(),
      buyerEmail,
    });
  } catch (error) {
    // The Razorpay order exists but we have nothing to reconcile it against.
    // Unpaid orders expire on their side; log loudly and refuse to continue.
    console.error(`create-order: insert failed for ${orderId} / ${razorpayOrder.id}`, error);
    return jsonError(req, 500, "server_error", "Could not start checkout. Please try again.");
  }

  return json(req, {
    orderId,
    razorpayOrderId: razorpayOrder.id,
    amount: guide.price_paise,
    currency: guide.currency,
    keyId: requireEnv(env, "RAZORPAY_KEY_ID"),
    guideTitle: guide.title,
  });
}
