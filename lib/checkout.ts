import type { Book } from "./books";

/**
 * Single entry point for starting a purchase. Wire this up to Razorpay
 * Checkout when payments are implemented: create the order via a Supabase
 * Edge Function (using NEXT_PUBLIC_RAZORPAY_KEY_ID client-side only), open
 * Razorpay Checkout, then on success redirect to /thank-you?order_id=...
 * Order creation and payment signature verification happen in the Edge
 * Function, never in this static frontend.
 */
export function startCheckout(book: Pick<Book, "slug" | "title" | "price">) {
  // eslint-disable-next-line no-console
  console.log("startCheckout: placeholder — Razorpay not wired up yet", book);
  window.alert(
    `Checkout isn't live yet. "${book.title}" — ₹${book.price}. Check back soon.`
  );
}
