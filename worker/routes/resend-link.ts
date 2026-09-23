// POST /api/resend-link  { email } -> { ok: true, message }
//
// Always the same answer, whatever is true on our side. If this ever returned
// "no orders found", it would become a way to test whether an address has
// bought from us — so a well-formed request gets one reply and one only.
// Ports the old Supabase Edge Functions.
import { isEmail, json, jsonError, methodNotAllowed, readJson } from "../lib/http";
import { allowResendRequest } from "../lib/rate-limit";
import { paidOrdersForEmail } from "../lib/orders";
import { downloadUrlFor } from "../lib/links";
import { sendEmail } from "../lib/email";
import { downloadLinksEmail } from "../lib/templates";
import type { WorkerEnv } from "../lib/env";

const GENERIC_REPLY = {
  ok: true,
  message:
    "If that email has bought a guide from Archivist, the download links are on their way. Check your spam folder if it does not arrive in a few minutes.",
};

export async function handleResendLink(req: Request, env: WorkerEnv): Promise<Response> {
  if (req.method !== "POST") return methodNotAllowed(req, "POST");

  const body = await readJson<{ email?: unknown }>(req);
  const email = typeof body?.email === "string" ? body.email.trim() : "";

  if (!isEmail(email)) {
    // A malformed address is a client bug, not a probe, so this one may differ.
    return jsonError(req, 400, "invalid_email", "Enter a valid email address.");
  }

  try {
    const withinLimit = await allowResendRequest(env, email);
    if (!withinLimit) {
      // Silently stop. Saying "too many requests" would confirm nothing about
      // the address, but it does invite retry loops; the generic reply is enough.
      console.warn("resend-link: hourly limit reached for an address");
      return json(req, GENERIC_REPLY);
    }

    const guides = await paidOrdersForEmail(env, email);
    if (guides.length === 0) {
      return json(req, GENERIC_REPLY);
    }

    const message = downloadLinksEmail(
      guides.map((guide) => ({
        guideTitle: guide.guide_title,
        downloadUrl: downloadUrlFor(env, guide.download_token),
      })),
    );

    const sent = await sendEmail(env, { to: email, ...message });
    if (!sent) {
      console.error("resend-link: send failed");
    }
  } catch (error) {
    // Even an internal failure returns the same body; the details are in the logs.
    console.error("resend-link: unexpected error", error);
  }

  return json(req, GENERIC_REPLY);
}
