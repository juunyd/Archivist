import { corsHeaders } from "./cors";

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

/**
 * Error responses carry a stable machine-readable `code` and a message that is
 * safe to show a buyer. Anything sensitive goes to the logs, never the body.
 */
export function jsonError(
  req: Request,
  status: number,
  code: string,
  message: string,
): Response {
  return json(req, { error: { code, message } }, status);
}

export async function readJson<T>(req: Request): Promise<T | null> {
  try {
    const body = await req.json();
    return (body && typeof body === "object") ? body as T : null;
  } catch {
    return null;
  }
}

export function methodNotAllowed(req: Request, allowed: string): Response {
  return jsonError(req, 405, "method_not_allowed", `Use ${allowed}.`);
}

// Input shapes we accept. Everything from the client is checked against these
// before it reaches D1 or Razorpay. Unchanged from
// the old Supabase Edge Functions.
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RAZORPAY_ID = /^[A-Za-z0-9_]{6,64}$/;
const HEX_64 = /^[a-f0-9]{64}$/i;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isSlug = (v: unknown): v is string =>
  typeof v === "string" && v.length <= 80 && SLUG.test(v);

export const isRazorpayId = (v: unknown): v is string =>
  typeof v === "string" && RAZORPAY_ID.test(v);

export const isHexSignature = (v: unknown): v is string =>
  typeof v === "string" && HEX_64.test(v);

export const isUuid = (v: unknown): v is string =>
  typeof v === "string" && UUID.test(v);

// Deliberately permissive: this rejects what cannot be an address, and leaves
// deciding whether it receives mail to the mail server.
const EMAIL = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

export const isEmail = (v: unknown): v is string =>
  typeof v === "string" && v.length <= 254 && EMAIL.test(v.trim());

/** j***@example.com — enough for a buyer to recognise, useless to a stranger. */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  if (at <= 0) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const head = local.slice(0, 1);
  return `${head}${"*".repeat(Math.max(local.length - 1, 1))}@${domain}`;
}
