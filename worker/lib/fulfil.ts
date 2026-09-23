import type { WorkerEnv } from "./env";
import type { OrderRow } from "./orders";
import { sendEmail } from "./email";
import { deliveryEmail } from "./templates";
import { downloadUrlFor } from "./links";

export type FulfilResult =
  | { status: "sent" }
  | { status: "already_fulfilled" }
  | { status: "not_payable" }
  | { status: "email_failed" };

/**
 * Delivers an order exactly once. Ports supabase/functions/_shared/fulfil.ts
 * onto D1: the `fulfilled_at is null` predicate on the UPDATE is still the
 * lock, D1 still lets exactly one caller's write match a given row.
 *
 * Both /api/verify and /api/webhooks/razorpay call this, often for the same
 * order and sometimes concurrently. If the email itself fails, fulfilled_at
 * is released so a later webhook retry can have another go — better a
 * second attempt than a silent loss.
 */
export async function fulfilOrder(env: WorkerEnv, orderId: string): Promise<FulfilResult> {
  const claimed = await env.DB
    .prepare(
      `UPDATE orders
          SET fulfilled_at = ?2
        WHERE id = ?1
          AND status = 'paid'
          AND fulfilled_at IS NULL
        RETURNING id, book_slug, buyer_email, download_token`,
    )
    .bind(orderId, new Date().toISOString())
    .first<Pick<OrderRow, "id" | "book_slug" | "buyer_email" | "download_token">>();

  if (!claimed) {
    // Either already delivered, or not paid yet. Both are no-ops.
    const existing = await env.DB
      .prepare(`SELECT status, fulfilled_at FROM orders WHERE id = ?1`)
      .bind(orderId)
      .first<Pick<OrderRow, "status" | "fulfilled_at">>();
    return existing?.fulfilled_at
      ? { status: "already_fulfilled" }
      : { status: "not_payable" };
  }

  if (!claimed.buyer_email) {
    // Paid but Razorpay gave us no address. Leave it claimed and alert the logs;
    // the buyer can pull the link themselves once support attaches an email.
    console.error(`fulfilOrder(${orderId}): paid order has no buyer email`);
    return { status: "email_failed" };
  }

  const book = await env.DB
    .prepare(`SELECT title FROM books WHERE slug = ?1`)
    .bind(claimed.book_slug)
    .first<{ title: string }>();

  const message = deliveryEmail({
    bookTitle: book?.title ?? "your Archivist book",
    downloadUrl: downloadUrlFor(env, claimed.download_token),
  });

  const sent = await sendEmail(env, { to: claimed.buyer_email, ...message });

  if (!sent) {
    await env.DB.prepare(`UPDATE orders SET fulfilled_at = NULL WHERE id = ?1`).bind(orderId).run();
    console.error(`fulfilOrder(${orderId}): delivery email failed, released for retry`);
    return { status: "email_failed" };
  }

  await env.DB
    .prepare(`UPDATE orders SET email_sent_at = ?2 WHERE id = ?1`)
    .bind(orderId, new Date().toISOString())
    .run();

  return { status: "sent" };
}
