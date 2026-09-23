// Meta Conversions API — the server-side half of the Purchase event. See
// lib/meta-pixel.ts for the browser half and lib/checkout.ts for how the two
// share an event_id so Meta deduplicates them instead of double-counting.
import { sha256Hex } from "./crypto";
import { siteUrl, type WorkerEnv } from "./env";

const GRAPH_VERSION = "v21.0";

interface PurchaseEventInput {
  orderId: string;
  eventId: string | null;
  guideSlug: string;
  amountPaise: number;
  currency: string;
  buyerEmail: string | null;
  buyerPhone: string | null;
  clientIp: string | null;
  clientUserAgent: string | null;
}

/** Digits only, with country code and no leading +. Assumes a bare 10-digit number is Indian. */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

/**
 * Sends the Purchase event to Meta. Never throws — a failure here must never
 * block fulfilment, so every error is caught, logged, and swallowed. Callers
 * should invoke this via `ctx.waitUntil` so it doesn't delay the response.
 */
export async function sendPurchaseEvent(env: WorkerEnv, input: PurchaseEventInput): Promise<void> {
  const pixelId = env.META_PIXEL_ID;
  const accessToken = env.META_CAPI_ACCESS_TOKEN;
  if (!pixelId || !accessToken) return;

  try {
    const userData: Record<string, string> = {};
    if (input.buyerEmail) {
      userData.em = await sha256Hex(input.buyerEmail.trim().toLowerCase());
    }
    if (input.buyerPhone) {
      userData.ph = await sha256Hex(normalizePhone(input.buyerPhone));
    }
    if (input.clientIp) userData.client_ip_address = input.clientIp;
    if (input.clientUserAgent) userData.client_user_agent = input.clientUserAgent;

    const eventPayload = {
      event_name: "Purchase",
      event_time: Math.floor(Date.now() / 1000),
      event_id: input.eventId ?? crypto.randomUUID(),
      action_source: "website",
      event_source_url: `${siteUrl(env)}/${input.guideSlug}/`,
      user_data: userData,
      custom_data: {
        value: input.amountPaise / 100,
        currency: input.currency,
        content_ids: [input.guideSlug],
        content_type: "product",
      },
    };

    const body: Record<string, unknown> = { data: [eventPayload] };
    if (env.META_TEST_EVENT_CODE) body.test_event_code = env.META_TEST_EVENT_CODE;

    const response = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );

    // Never log the token or raw email/phone — order id and status are enough to debug from.
    if (!response.ok) {
      const text = await response.text();
      console.error(`meta-capi: Purchase for order ${input.orderId} -> ${response.status}: ${text}`);
      return;
    }
    console.log(`meta-capi: Purchase sent for order ${input.orderId} -> ${response.status}`);
  } catch (error) {
    console.error(`meta-capi: Purchase for order ${input.orderId} threw`, error);
  }
}
