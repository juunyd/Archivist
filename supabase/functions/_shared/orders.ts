import { adminClient, type OrderRow } from "./supabase.ts";
import { isPaidStatus, type RazorpayPayment } from "./razorpay.ts";

export async function findOrderByRazorpayOrderId(
  razorpayOrderId: string,
): Promise<OrderRow | null> {
  const { data, error } = await adminClient()
    .from("orders")
    .select("*")
    .eq("razorpay_order_id", razorpayOrderId)
    .maybeSingle<OrderRow>();
  if (error) {
    console.error("order lookup failed", error);
    throw error;
  }
  return data;
}

export type PaymentCheck =
  | { ok: true }
  | { ok: false; code: string; detail: string };

/**
 * Confirms that what Razorpay says about this payment matches the order we
 * created. A valid signature only proves the message came from Razorpay — it
 * does not prove the amount, currency or order are the ones we asked for.
 */
export function checkPaymentMatchesOrder(
  order: OrderRow,
  payment: RazorpayPayment,
): PaymentCheck {
  if (!isPaidStatus(payment.status)) {
    return { ok: false, code: "payment_not_captured", detail: `status=${payment.status}` };
  }
  if (payment.order_id !== order.razorpay_order_id) {
    return {
      ok: false,
      code: "order_mismatch",
      detail: `payment.order_id=${payment.order_id} order=${order.razorpay_order_id}`,
    };
  }
  if (payment.amount !== order.amount_paise) {
    return {
      ok: false,
      code: "amount_mismatch",
      detail: `paid=${payment.amount} expected=${order.amount_paise}`,
    };
  }
  if (payment.currency !== order.currency) {
    return {
      ok: false,
      code: "currency_mismatch",
      detail: `paid=${payment.currency} expected=${order.currency}`,
    };
  }
  return { ok: true };
}

/**
 * Moves an order to paid, once. The `status = 'created'` predicate makes this
 * a no-op for whichever of verify-payment / webhook arrives second, so buyer
 * details are never overwritten and paid_at keeps the first timestamp.
 *
 * Razorpay's email wins when it has one, since that is the address the buyer
 * confirmed at the payment step. When it has none, the address captured before
 * checkout stays put rather than being blanked — that address is the only way
 * to deliver the book.
 */
export async function markOrderPaid(input: {
  orderId: string;
  paymentId: string;
  email: string | null;
  phone: string | null;
}): Promise<{ changed: boolean }> {
  const patch: Record<string, unknown> = {
    status: "paid",
    razorpay_payment_id: input.paymentId,
    paid_at: new Date().toISOString(),
  };
  if (input.email) patch.buyer_email = input.email;
  if (input.phone) patch.buyer_phone = input.phone;

  const { data, error } = await adminClient()
    .from("orders")
    .update(patch)
    .eq("id", input.orderId)
    .eq("status", "created")
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) {
    console.error(`markOrderPaid(${input.orderId}) failed`, error);
    throw error;
  }
  return { changed: Boolean(data) };
}

/** Only a still-open order can fail; a paid order stays paid. */
export async function markOrderFailed(orderId: string): Promise<void> {
  const { error } = await adminClient()
    .from("orders")
    .update({ status: "failed" })
    .eq("id", orderId)
    .eq("status", "created");
  if (error) console.error(`markOrderFailed(${orderId}) failed`, error);
}
