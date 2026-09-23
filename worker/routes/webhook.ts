// POST /api/webhooks/razorpay — Razorpay -> us, server to server. No CORS
// preflight applies (Razorpay sends no Origin/OPTIONS), no auth beyond the
// signature over the raw body. Ports
// the old Supabase Edge Functions.
//
// This is the safety net: if the buyer closes the tab before /api/verify
// runs, the order is still marked paid and delivered from here.
import { verifyHmacSignature } from "../lib/crypto";
import {
  checkPaymentMatchesOrder,
  findOrderByRazorpayOrderId,
  markOrderFailed,
  markOrderPaid,
} from "../lib/orders";
import { fulfilOrder } from "../lib/fulfil";
import { requireEnv, type WorkerEnv } from "../lib/env";
import type { RazorpayPayment } from "../lib/razorpay";

const ok = (detail: string) =>
  new Response(JSON.stringify({ ok: true, detail }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

interface WebhookBody {
  event?: string;
  payload?: {
    payment?: { entity?: RazorpayPayment };
    order?: { entity?: { id?: string } };
  };
}

export async function handleWebhook(req: Request, env: WorkerEnv): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // The signature covers the bytes exactly as sent, so read text once and
  // parse from that string — never re-serialise before verifying.
  const rawBody = await req.text();
  const signature = req.headers.get("X-Razorpay-Signature");

  if (!signature) {
    return new Response("Missing signature", { status: 401 });
  }

  const valid = await verifyHmacSignature(
    requireEnv(env, "RAZORPAY_WEBHOOK_SECRET"),
    rawBody,
    signature,
  );
  if (!valid) {
    console.error("webhook: signature verification failed");
    return new Response("Invalid signature", { status: 401 });
  }

  let body: WebhookBody;
  try {
    body = JSON.parse(rawBody) as WebhookBody;
  } catch {
    return new Response("Malformed body", { status: 400 });
  }

  const event = body.event ?? "";
  const payment = body.payload?.payment?.entity;

  try {
    switch (event) {
      case "payment.captured":
      case "order.paid": {
        const razorpayOrderId = payment?.order_id ?? body.payload?.order?.entity?.id;
        if (!razorpayOrderId || !payment) {
          console.error(`webhook: ${event} with no usable payment entity`);
          return ok("ignored: incomplete payload");
        }

        const order = await findOrderByRazorpayOrderId(env, razorpayOrderId);
        if (!order) {
          // Not ours (or created by another environment sharing this key).
          console.error(`webhook: unknown order ${razorpayOrderId}`);
          return ok("ignored: unknown order");
        }

        const check = checkPaymentMatchesOrder(order, payment);
        if (!check.ok) {
          console.error(`webhook: ${check.code} for ${order.id} — ${check.detail}`);
          return ok(`ignored: ${check.code}`);
        }

        // Both of these are no-ops on a replay: markOrderPaid only matches a
        // 'created' row, fulfilOrder only matches fulfilled_at is null.
        const { changed } = await markOrderPaid(env, {
          orderId: order.id,
          paymentId: payment.id,
          email: payment.email,
          phone: payment.contact,
        });
        const result = await fulfilOrder(env, order.id);
        return ok(`${event}: paid_now=${changed} fulfil=${result.status}`);
      }

      case "payment.failed": {
        const razorpayOrderId = payment?.order_id;
        if (!razorpayOrderId) return ok("ignored: no order id");
        const order = await findOrderByRazorpayOrderId(env, razorpayOrderId);
        if (!order) return ok("ignored: unknown order");
        await markOrderFailed(env, order.id);
        return ok("payment.failed recorded");
      }

      default:
        return ok(`ignored: ${event || "unnamed event"}`);
    }
  } catch (error) {
    // A 500 makes Razorpay retry, which is what we want for a transient fault.
    console.error(`webhook: handler threw on ${event}`, error);
    return new Response("Handler error", { status: 500 });
  }
}
