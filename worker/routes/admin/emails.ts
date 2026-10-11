// GET /api/admin/emails/started -> buyers who started a checkout but never
//   paid (and have never paid since, on any order) — paginated/searchable/
//   sortable, or ?format=csv for the full list as a download. The other
//   Emails list ("Buyers") is just worker/routes/admin/customers.ts reused —
//   same underlying data as the Customers page. Read-only.
import { methodNotAllowed, json, jsonError } from "../../lib/http";
import { requireAccess } from "../../lib/access";
import { csvResponse } from "../../lib/csv";
import { listAbandonedCheckouts, type AbandonedSortKey, type SortDir } from "../../lib/customers-admin";
import type { WorkerEnv } from "../../lib/env";

const SORT_KEYS: AbandonedSortKey[] = ["email", "attempts", "last"];

function formatIst(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export async function handleAdminEmailsStarted(req: Request, env: WorkerEnv): Promise<Response> {
  if (req.method !== "GET") return methodNotAllowed(req, "GET");

  const access = await requireAccess(req, env);
  if (!access.ok) return access.response;

  const sp = new URL(req.url).searchParams;

  const sortParam = (sp.get("sort") ?? "last") as AbandonedSortKey;
  if (!SORT_KEYS.includes(sortParam)) {
    return jsonError(req, 400, "invalid_request", "sort must be email, attempts, or last.");
  }
  const dir = sp.get("dir") === "asc" ? "asc" : ("desc" as SortDir);
  const search = sp.get("search")?.trim().slice(0, 200) || null;
  const isCsv = sp.get("format") === "csv";

  try {
    if (isCsv) {
      const { rows } = await listAbandonedCheckouts(env, {
        search,
        sort: sortParam,
        dir,
        page: 1,
        pageSize: 0,
        all: true,
      });
      return csvResponse(
        req,
        "started-checkout-no-payment.csv",
        ["Email", "Attempts", "Last attempt (IST)", "Last guide viewed"],
        rows.map((r) => [r.email, String(r.attempts_count), formatIst(r.last_attempt_at), r.last_guide_title ?? ""]),
      );
    }

    const page = Math.max(1, Number.parseInt(sp.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(sp.get("pageSize") ?? "20", 10) || 20));

    const { rows, total } = await listAbandonedCheckouts(env, { search, sort: sortParam, dir, page, pageSize });
    return json(req, {
      rows: rows.map((r) => ({
        email: r.email,
        attemptsCount: r.attempts_count,
        lastAttemptAt: r.last_attempt_at,
        lastGuideTitle: r.last_guide_title,
      })),
      total,
      page,
      pageSize,
    });
  } catch (error) {
    console.error("admin/emails: started list failed", error);
    return jsonError(req, 500, "server_error", "Could not load the list.");
  }
}
