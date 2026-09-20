// POST { razorpay_order_id, razorpay_payment_id, razorpay_signature }
//   -> { orderId, status }
//
// Called by the browser right after Razorpay Checkout succeeds. This is the
// fast path; the webhook is the safety net that fulfils the same order if the
// buyer closes the tab before this ever runs.
import { preflight } from "../_shared/cors.ts";
import {
  isHexSignature,
  isRazorpayId,
  json,
  jsonError,
  methodNotAllowed,
  readJson,
} from "../_shared/http.ts";
import { verifyHmacSignature } from "../_shared/crypto.ts";
import { fetchRazorpayPayment } from "../_shared/razorpay.ts";
import {
  checkPaymentMatchesOrder,
  findOrderByRazorpayOrderId,
  markOrderPaid,
} from "../_shared/orders.ts";
import { fulfilOrder } from "../_shared/fulfil.ts";
import { requireEnv } from "../_shared/env.ts";

interface Body {
  razorpay_order_id?: unknown;
  razorpay_payment_id?: unknown;
  razorpay_signature?: unknown;
}

Deno.serve(async (req) => {
  const options = preflight(req);
  if (options) return options;
  if (req.method !== "POST") return methodNotAllowed(req, "POST");

  const body = await readJson<Body>(req);
  if (
    !body ||
    !isRazorpayId(body.razorpay_order_id) ||
    !isRazorpayId(body.razorpay_payment_id) ||
    !isHexSignature(body.razorpay_signature)
  ) {
    return jsonError(req, 400, "invalid_request", "Missing or malformed payment details.");
  }

  const razorpayOrderId = body.razorpay_order_id;
  const razorpayPaymentId = body.razorpay_payment_id;

  // 1. The signature proves Razorpay sent these two ids together.
  const signatureValid = await verifyHmacSignature(
    requireEnv("RAZORPAY_KEY_SECRET"),
    `${razorpayOrderId}|${razorpayPaymentId}`,
    body.razorpay_signature,
  );
  if (!signatureValid) {
    console.error(`verify-payment: bad signature for ${razorpayOrderId}`);
    return jsonError(req, 400, "invalid_signature", "We could not verify this payment.");
  }

  // 2. The order must be one we created.
  let order;
  try {
    order = await findOrderByRazorpayOrderId(razorpayOrderId);
  } catch {
    return jsonError(req, 500, "server_error", "Could not verify this payment. Please contact support.");
  }
  if (!order) {
    console.error(`verify-payment: unknown razorpay order ${razorpayOrderId}`);
    return jsonError(req, 404, "order_not_found", "We could not find that order.");
  }

  // 3. Ask Razorpay directly what it holds — never trust the client's numbers.
  let payment;
  try {
    payment = await fetchRazorpayPayment(razorpayPaymentId);
  } catch (error) {
    console.error("verify-payment: payment fetch failed", error);
    return jsonError(req, 502, "payment_provider_error", "Could not reach the payment provider. Please try again.");
  }

  const check = checkPaymentMatchesOrder(order, payment);
  if (!check.ok) {
    console.error(`verify-payment: ${check.code} for order ${order.id} — ${check.detail}`);
    return jsonError(req, 400, check.code, "This payment could not be verified.");
  }

  // 4. Record it, once, then deliver, once.
  try {
    await markOrderPaid({
      orderId: order.id,
      paymentId: payment.id,
      email: payment.email,
      phone: payment.contact,
    });
  } catch {
    return jsonError(req, 500, "server_error", "Your payment went through, but we could not record it. Please contact support.");
  }

  try {
    await fulfilOrder(order.id);
  } catch (error) {
    // The money is safe and the order is paid. Delivery can still be retried
    // by the webhook, so the buyer gets a success response either way.
    console.error(`verify-payment: fulfilment failed for ${order.id}`, error);
  }

  return json(req, { orderId: order.id, status: "paid" });
});
