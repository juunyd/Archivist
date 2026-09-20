import { adminClient, type OrderRow } from "./supabase.ts";
import { siteUrl } from "./env.ts";
import { sendEmail } from "./email.ts";
import { deliveryEmail } from "./templates.ts";

export const downloadUrlFor = (token: string): string =>
  `${siteUrl()}/download/?token=${token}`;

export type FulfilResult =
  | { status: "sent" }
  | { status: "already_fulfilled" }
  | { status: "not_payable" }
  | { status: "email_failed" };

/**
 * Delivers an order exactly once.
 *
 * Both verify-payment and the webhook call this, often for the same order and
 * sometimes concurrently. The `fulfilled_at is null` predicate on the UPDATE is
 * the lock: Postgres lets exactly one caller's update match, and everyone else
 * sees zero rows and returns early. No buyer gets two emails.
 *
 * If the email itself fails, fulfilled_at is released so a later webhook
 * retry can have another go — better a second attempt than a silent loss.
 */
export async function fulfilOrder(orderId: string): Promise<FulfilResult> {
  const db = adminClient();

  const { data: claimed, error: claimError } = await db
    .from("orders")
    .update({ fulfilled_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("status", "paid")
    .is("fulfilled_at", null)
    .select("id, book_slug, buyer_email, download_token")
    .maybeSingle<Pick<OrderRow, "id" | "book_slug" | "buyer_email" | "download_token">>();

  if (claimError) {
    console.error(`fulfilOrder(${orderId}): claim failed`, claimError);
    throw claimError;
  }
  if (!claimed) {
    // Either already delivered, or not paid yet. Both are no-ops.
    const { data: existing } = await db
      .from("orders")
      .select("status, fulfilled_at")
      .eq("id", orderId)
      .maybeSingle<Pick<OrderRow, "status" | "fulfilled_at">>();
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

  const { data: book } = await db
    .from("books")
    .select("title")
    .eq("slug", claimed.book_slug)
    .maybeSingle<{ title: string }>();

  const message = deliveryEmail({
    bookTitle: book?.title ?? "your Archivist book",
    downloadUrl: downloadUrlFor(claimed.download_token),
  });

  const sent = await sendEmail({ to: claimed.buyer_email, ...message });

  if (!sent) {
    await db.from("orders").update({ fulfilled_at: null }).eq("id", orderId);
    console.error(`fulfilOrder(${orderId}): delivery email failed, released for retry`);
    return { status: "email_failed" };
  }

  await db
    .from("orders")
    .update({ email_sent_at: new Date().toISOString() })
    .eq("id", orderId);

  return { status: "sent" };
}
