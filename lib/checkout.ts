import { FunctionError, postFunction } from "./supabase-functions";

/**
 * Razorpay Checkout, start to finish.
 *
 * The browser never names a price: it sends a slug, the Edge Function looks up
 * what that book costs and creates the Razorpay order, and the amount comes
 * back only so Checkout can display it. Verification happens server-side too —
 * nothing here can mark an order paid.
 */

const CHECKOUT_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

export type CheckoutPhase =
  | "idle"
  | "creating"
  | "open"
  | "verifying"
  | "redirecting";

export interface CheckoutHandlers {
  onPhase?(phase: CheckoutPhase): void;
  onError?(message: string): void;
}

interface CreateOrderResponse {
  orderId: string;
  razorpayOrderId: string;
  amount: number;
  currency: string;
  keyId: string;
  bookTitle: string;
}

interface RazorpaySuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open(): void;
  on(event: string, handler: (payload: unknown) => void): void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

/** Loaded at most once per page, however many buy buttons are clicked. */
let scriptPromise: Promise<void> | null = null;

function loadCheckoutScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CHECKOUT_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      // Let a later click retry rather than caching the failure forever.
      scriptPromise = null;
      reject(new FunctionError("script_failed", "Could not load the payment window. Check your connection and try again."));
    };
    document.head.appendChild(script);
  });

  return scriptPromise;
}

/** Guards against a double click landing two orders in the database. */
let inFlight = false;

export async function startCheckout(
  slug: string,
  handlers: CheckoutHandlers = {},
): Promise<void> {
  const { onPhase, onError } = handlers;
  const phase = (next: CheckoutPhase) => onPhase?.(next);
  const fail = (error: unknown) => {
    inFlight = false;
    phase("idle");
    onError?.(
      error instanceof FunctionError
        ? error.message
        : "Something went wrong. Please try again.",
    );
  };

  if (inFlight) return;
  inFlight = true;

  let order: CreateOrderResponse;
  try {
    phase("creating");
    order = await postFunction<CreateOrderResponse>("create-order", { slug });
    await loadCheckoutScript();
  } catch (error) {
    fail(error);
    return;
  }

  if (!window.Razorpay) {
    fail(new FunctionError("script_failed", "Could not load the payment window. Please try again."));
    return;
  }

  const checkout = new window.Razorpay({
    key: order.keyId,
    order_id: order.razorpayOrderId,
    amount: order.amount,
    currency: order.currency,
    name: "Archivist",
    description: order.bookTitle,
    // No prefill: we collect nothing before payment, and Razorpay hands us
    // the buyer's email afterwards.
    theme: { color: "#0a0a0a" },
    modal: {
      ondismiss: () => {
        inFlight = false;
        phase("idle");
        onError?.("Checkout closed — you have not been charged.");
      },
    },
    handler: async (response: RazorpaySuccess) => {
      phase("verifying");
      try {
        await postFunction("verify-payment", {
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        });
      } catch (error) {
        // The payment itself succeeded; only our confirmation call failed.
        // The webhook will still fulfil the order, and the thank-you page
        // polls for exactly that, so send the buyer there either way rather
        // than leaving them on a dead-end error.
        console.error("verify-payment failed, falling back to the webhook", error);
      }
      phase("redirecting");
      window.location.assign(`/thank-you/?order_id=${encodeURIComponent(order.orderId)}`);
    },
  });

  checkout.on("payment.failed", () => {
    inFlight = false;
    phase("idle");
    onError?.("That payment did not go through. No money was taken — please try again.");
  });

  phase("open");
  checkout.open();
}
