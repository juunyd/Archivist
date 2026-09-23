// Identical to the old Supabase Edge Functions — Web Crypto is the same
// API on Cloudflare Workers as it was on Supabase's Deno runtime, so nothing
// here needed to change to move backends.

/** SHA-256 of `message`, lowercase hex — for Meta CAPI's hashed user-data fields. */
export async function sha256Hex(message: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(message));
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** HMAC-SHA256 of `message` under `secret`, lowercase hex. */
export async function hmacSha256Hex(
  secret: string,
  message: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message),
  );
  return [...new Uint8Array(signature)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Length-independent, content-independent comparison. Runs in time that does
 * not depend on where the first differing byte is, so an attacker cannot walk
 * a forged signature into place one character at a time.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  // Compare over a fixed length so the loop count does not leak either length.
  const length = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;
  for (let i = 0; i < length; i++) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}

/** Verifies a Razorpay-style hex signature over `payload`. */
export async function verifyHmacSignature(
  secret: string,
  payload: string,
  signature: string,
): Promise<boolean> {
  const expected = await hmacSha256Hex(secret, payload);
  return timingSafeEqual(expected, signature.toLowerCase());
}
