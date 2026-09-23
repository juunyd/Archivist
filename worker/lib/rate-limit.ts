import type { WorkerEnv } from "./env";

export const RESEND_MAX_PER_HOUR = 3;

/**
 * Records this attempt and reports whether it is within the hourly cap.
 *
 * The row is always written, including for addresses that have never bought
 * anything, so an attacker cannot tell the two cases apart by timing. Same
 * logic as supabase/functions/_shared/rate-limit.ts, against D1 instead of
 * Postgres.
 */
export async function allowResendRequest(env: WorkerEnv, email: string): Promise<boolean> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const normalised = email.trim().toLowerCase();

  try {
    await env.DB
      .prepare(`INSERT INTO resend_requests (email) VALUES (?1)`)
      .bind(normalised)
      .run();
  } catch (error) {
    console.error("rate-limit: could not record request", error);
  }

  try {
    const row = await env.DB
      .prepare(
        `SELECT COUNT(*) AS count
           FROM resend_requests
          WHERE lower(email) = ?1 AND requested_at >= ?2`,
      )
      .bind(normalised, since)
      .first<{ count: number }>();

    return (row?.count ?? 0) <= RESEND_MAX_PER_HOUR;
  } catch (error) {
    console.error("rate-limit: count failed, denying send", error);
    return false; // Fail closed: better a missed resend than an open relay.
  }
}
