/**
 * The Worker's environment: D1 for data, R2 for the PDFs, ASSETS for the
 * Next.js static export, and the same set of secrets the Supabase Edge
 * Functions used to read — set the same way, just with `wrangler secret put`
 * instead of `supabase secrets set`.
 *
 * Named WorkerEnv (not `Env`) on purpose: `wrangler types` generates its own
 * ambient global `Env` from wrangler.jsonc's bindings, and that generated
 * interface currently also picks up the frontend's NEXT_PUBLIC_* build vars
 * from .env.local, which have nothing to do with what this Worker actually
 * receives at runtime. Keeping our own explicit type here avoids relying on
 * that.
 */
export interface WorkerEnv {
  DB: D1Database;
  // Binding name matches the R2 bucket name (archivist-book-files), kept
  // as-is on the rename to "guide" — see the note in lib/guides.ts.
  BOOK_FILES: R2Bucket;
  ASSETS: Fetcher;

  // Non-secret configuration. Set as `vars` in wrangler.jsonc.
  SITE_URL?: string;
  EMAIL_FROM?: string;

  // Secrets. Set with `wrangler secret put <NAME>`; never in wrangler.jsonc.
  // RAZORPAY_KEY_ID isn't sensitive on its own (create-order already hands it
  // to the browser), but it's kept alongside the other three so every
  // Razorpay/Resend credential is set the same way, in one place, and none of
  // them end up hardcoded in version control.
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
  RAZORPAY_WEBHOOK_SECRET?: string;
  RESEND_API_KEY?: string;
}

type StringEnvKey =
  | "SITE_URL"
  | "EMAIL_FROM"
  | "RAZORPAY_KEY_ID"
  | "RAZORPAY_KEY_SECRET"
  | "RAZORPAY_WEBHOOK_SECRET"
  | "RESEND_API_KEY";

/** Reads a required secret/var, failing loudly at request time rather than mid-payment. */
export function requireEnv(env: WorkerEnv, key: StringEnvKey): string {
  const value = env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/** Canonical site origin, used to build download links in emails. */
export function siteUrl(env: WorkerEnv): string {
  return (env.SITE_URL || "https://archivist.in").replace(/\/+$/, "");
}

export function emailFromAddress(env: WorkerEnv): string {
  return env.EMAIL_FROM || "Archivist <noreply@archivist.in>";
}

export const supportEmail = "hello@archivist.in";
