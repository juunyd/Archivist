// POST { email } -> { ok: true, message }
//
// Always the same answer, whatever is true on our side. If this ever returned
// "no orders found", it would become a way to test whether an address has
// bought from us — so a well-formed request gets one reply and one only.
import { preflight } from "../_shared/cors.ts";
import { isEmail, json, jsonError, methodNotAllowed, readJson } from "../_shared/http.ts";
import { adminClient } from "../_shared/supabase.ts";
import { allowResendRequest } from "../_shared/rate-limit.ts";
import { downloadUrlFor } from "../_shared/fulfil.ts";
import { sendEmail } from "../_shared/email.ts";
import { downloadLinksEmail } from "../_shared/templates.ts";

const GENERIC_REPLY = {
  ok: true,
  message:
    "If that email has bought a book from Archivist, the download links are on their way. Check your spam folder if it does not arrive in a few minutes.",
};

interface PurchasedBook {
  book_slug: string;
  book_title: string;
  download_token: string;
}

Deno.serve(async (req) => {
  const options = preflight(req);
  if (options) return options;
  if (req.method !== "POST") return methodNotAllowed(req, "POST");

  const body = await readJson<{ email?: unknown }>(req);
  const email = typeof body?.email === "string" ? body.email.trim() : "";

  if (!isEmail(email)) {
    // A malformed address is a client bug, not a probe, so this one may differ.
    return jsonError(req, 400, "invalid_email", "Enter a valid email address.");
  }

  try {
    const withinLimit = await allowResendRequest(email);
    if (!withinLimit) {
      // Silently stop. Saying "too many requests" would confirm nothing about
      // the address, but it does invite retry loops; the generic reply is enough.
      console.warn("resend-download-link: hourly limit reached for an address");
      return json(req, GENERIC_REPLY);
    }

    const { data, error } = await adminClient()
      .rpc("paid_orders_for_email", { p_email: email });

    if (error) {
      console.error("resend-download-link: lookup failed", error);
      return json(req, GENERIC_REPLY);
    }

    const books = (data ?? []) as PurchasedBook[];
    if (books.length === 0) {
      return json(req, GENERIC_REPLY);
    }

    const message = downloadLinksEmail(
      books.map((book) => ({
        bookTitle: book.book_title,
        downloadUrl: downloadUrlFor(book.download_token),
      })),
    );

    const sent = await sendEmail({ to: email, ...message });
    if (!sent) {
      console.error("resend-download-link: send failed");
    }
  } catch (error) {
    // Even an internal failure returns the same body; the details are in the logs.
    console.error("resend-download-link: unexpected error", error);
  }

  return json(req, GENERIC_REPLY);
});
