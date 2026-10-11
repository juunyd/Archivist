// GET  /api/admin/ad-spend?days=30 -> recent daily_ad_spend rows, newest first.
// POST /api/admin/ad-spend { date, amountPaise, note? } -> upsert one day's spend.
import { json, jsonError, methodNotAllowed, readJson } from "../../lib/http";
import { requireAccess } from "../../lib/access";
import { istDateDaysAgo, isIstDateString } from "../../lib/ist";
import type { WorkerEnv } from "../../lib/env";

function isValidAmountPaise(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 1_000_000_000;
}

interface AdSpendRow {
  date: string;
  amount_paise: number;
  note: string | null;
  updated_at: string;
}

export async function handleAdminAdSpend(req: Request, env: WorkerEnv): Promise<Response> {
  const access = await requireAccess(req, env);
  if (!access.ok) return access.response;

  if (req.method === "GET") {
    const daysParam = new URL(req.url).searchParams.get("days");
    const days = Math.min(Math.max(Number.parseInt(daysParam ?? "30", 10) || 30, 1), 365);
    const since = istDateDaysAgo(days - 1);

    try {
      const result = await env.DB
        .prepare(`SELECT date, amount_paise, note, updated_at FROM daily_ad_spend WHERE date >= ?1 ORDER BY date DESC`)
        .bind(since)
        .all<AdSpendRow>();
      return json(req, {
        entries: (result.results ?? []).map((row) => ({
          date: row.date,
          amountPaise: row.amount_paise,
          note: row.note,
          updatedAt: row.updated_at,
        })),
      });
    } catch (error) {
      console.error("admin/ad-spend: list failed", error);
      return jsonError(req, 500, "server_error", "Could not load ad spend.");
    }
  }

  if (req.method === "POST") {
    const body = await readJson<{ date?: unknown; amountPaise?: unknown; note?: unknown }>(req);
    if (!body || !isIstDateString(body.date)) {
      return jsonError(req, 400, "invalid_request", "A valid date (YYYY-MM-DD) is required.");
    }
    if (!isValidAmountPaise(body.amountPaise)) {
      return jsonError(req, 400, "invalid_request", "amountPaise must be a non-negative integer.");
    }
    const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 500) : null;

    try {
      await env.DB
        .prepare(
          `INSERT INTO daily_ad_spend (date, amount_paise, note, updated_at)
           VALUES (?1, ?2, ?3, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
           ON CONFLICT (date) DO UPDATE SET
             amount_paise = excluded.amount_paise,
             note = excluded.note,
             updated_at = excluded.updated_at`,
        )
        .bind(body.date, body.amountPaise, note)
        .run();
      return json(req, { date: body.date, amountPaise: body.amountPaise, note });
    } catch (error) {
      console.error("admin/ad-spend: upsert failed", error);
      return jsonError(req, 500, "server_error", "Could not save ad spend.");
    }
  }

  return methodNotAllowed(req, "GET, POST");
}
