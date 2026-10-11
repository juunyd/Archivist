// POST /api/track/view { slug } — one-time-per-visit guide page view counter
// for the admin Overview funnel. Public (no requireAccess — called from the
// public guide page itself), but still real validation: the slug must look
// right and must name a currently published guide, or this rejects instead
// of silently counting garbage.
//
// The increment is fired via ctx.waitUntil and never awaited, so a slow or
// failing D1 write can never slow down or break the guide page that called
// this. No cookie, IP address or buyer identity is read or stored here.
import { isSlug, jsonError, methodNotAllowed, readJson } from "../lib/http";
import { isBotUserAgent, recordPageView } from "../lib/page-views";
import type { WorkerEnv } from "../lib/env";

interface TrackViewBody {
  slug?: unknown;
}

export async function handleTrackView(req: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
  if (req.method !== "POST") return methodNotAllowed(req, "POST");

  const body = await readJson<TrackViewBody>(req);
  if (!body || !isSlug(body.slug)) {
    return jsonError(req, 400, "invalid_request", "slug must be a valid guide slug.");
  }
  const slug = body.slug;

  // Bots never get counted — bail before touching D1 at all.
  if (isBotUserAgent(req.headers.get("User-Agent"))) {
    return new Response(null, { status: 204 });
  }

  try {
    const published = await env.DB
      .prepare(`SELECT 1 FROM books WHERE slug = ?1 AND status = 'published'`)
      .bind(slug)
      .first();
    if (!published) {
      return jsonError(req, 404, "not_found", "No published guide with that slug.");
    }
  } catch (error) {
    console.error("track/view: guide lookup failed", error);
    return jsonError(req, 500, "server_error", "Could not record this view.");
  }

  ctx.waitUntil(
    recordPageView(env, slug).catch((error) => {
      console.error("track/view: increment failed", error);
    }),
  );

  return new Response(null, { status: 204 });
}
