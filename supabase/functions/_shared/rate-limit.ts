import { adminClient } from "./supabase.ts";

export const RESEND_MAX_PER_HOUR = 3;

/**
 * Records this attempt and reports whether it is within the hourly cap.
 *
 * The row is always written, including for addresses that have never bought
 * anything, so an attacker cannot tell the two cases apart by timing.
 */
export async function allowResendRequest(email: string): Promise<boolean> {
  const db = adminClient();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const normalised = email.trim().toLowerCase();

  const { error: insertError } = await db
    .from("resend_requests")
    .insert({ email: normalised });
  if (insertError) {
    console.error("rate-limit: could not record request", insertError);
  }

  const { count, error } = await db
    .from("resend_requests")
    .select("id", { count: "exact", head: true })
    .eq("email", normalised)
    .gte("requested_at", since);

  if (error) {
    console.error("rate-limit: count failed, denying send", error);
    return false; // Fail closed: better a missed resend than an open relay.
  }

  return (count ?? 0) <= RESEND_MAX_PER_HOUR;
}
