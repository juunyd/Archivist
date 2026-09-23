/**
 * Browser-side Meta Pixel. Reads the dataset id from
 * NEXT_PUBLIC_META_PIXEL_ID (inlined at build time); every function here is a
 * no-op when it's unset, so a build/deploy with no pixel configured still
 * works, it just tracks nothing.
 *
 * Purchase is sent from both here (see lib/checkout.ts) and server-side via
 * Meta's Conversions API (worker/lib/meta-capi.ts), sharing one event_id so
 * Meta deduplicates them into a single sale. Browser-only would miss buyers
 * with ad blockers or ITP/iOS restrictions; server-only would lose the
 * click-time browser signals (fbp/fbc, precise user agent) that improve match
 * quality. Sending both and deduplicating gets the reliability of the server
 * event with the richer signal of the browser one.
 */
export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & {
      queue?: unknown[];
      loaded?: boolean;
      version?: string;
      callMethod?: (...args: unknown[]) => void;
    };
    _fbq?: Window["fbq"];
  }
}

export interface ProductEventParams {
  content_ids: string[];
  content_name?: string;
  content_type: "product";
  value: number;
  currency: string;
}

function fire(eventName: string, params: ProductEventParams, eventId?: string): void {
  if (!META_PIXEL_ID || typeof window === "undefined" || !window.fbq) return;
  if (eventId) {
    window.fbq("track", eventName, params, { eventID: eventId });
  } else {
    window.fbq("track", eventName, params);
  }
}

export const trackViewContent = (params: ProductEventParams): void => fire("ViewContent", params);

export const trackInitiateCheckout = (params: ProductEventParams, eventId: string): void =>
  fire("InitiateCheckout", params, eventId);

export const trackPurchase = (params: ProductEventParams, eventId: string): void =>
  fire("Purchase", params, eventId);
