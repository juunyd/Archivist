// GET /api/admin/rebuild-status and POST /api/admin/rebuild — triggers the
// Cloudflare deploy hook so guide edits (which only ever land in D1) reach
// the static build. Both routes call requireAccess() first.
//
// CLOUDFLARE_DEPLOY_HOOK_URL is a Worker secret, never read by the frontend.
// The status route exists so the admin UI can disable "Publish changes" and
// explain why *before* the user clicks it, instead of only failing after —
// but the POST route re-checks independently, since the client's state is
// never trusted as the real gate.
import { json, jsonError, methodNotAllowed } from "../../lib/http";
import { requireAccess } from "../../lib/access";
import type { WorkerEnv } from "../../lib/env";

const DEPLOY_HOOK_ORIGIN = "https://api.cloudflare.com";

function isValidDeployHookUrl(url: string): boolean {
  try {
    return new URL(url).origin === DEPLOY_HOOK_ORIGIN;
  } catch {
    return false;
  }
}

function deployHookProblem(env: WorkerEnv): string | null {
  const url = env.CLOUDFLARE_DEPLOY_HOOK_URL;
  if (!url) {
    return "The deploy hook isn't set up yet. Set CLOUDFLARE_DEPLOY_HOOK_URL as a Worker secret, then try again.";
  }
  if (!isValidDeployHookUrl(url)) {
    return "The deploy hook is misconfigured (CLOUDFLARE_DEPLOY_HOOK_URL must be an https://api.cloudflare.com/... URL).";
  }
  return null;
}

export async function handleAdminRebuildStatus(req: Request, env: WorkerEnv): Promise<Response> {
  if (req.method !== "GET") return methodNotAllowed(req, "GET");

  const access = await requireAccess(req, env);
  if (!access.ok) return access.response;

  const problem = deployHookProblem(env);
  return json(req, { configured: problem === null, reason: problem });
}

export async function handleAdminRebuild(req: Request, env: WorkerEnv): Promise<Response> {
  if (req.method !== "POST") return methodNotAllowed(req, "POST");

  const access = await requireAccess(req, env);
  if (!access.ok) return access.response;

  const problem = deployHookProblem(env);
  if (problem) {
    return jsonError(req, 503, "not_configured", problem);
  }

  let response: Response;
  try {
    response = await fetch(env.CLOUDFLARE_DEPLOY_HOOK_URL!, { method: "POST" });
  } catch (error) {
    console.error("admin/rebuild: deploy hook request failed", error);
    return jsonError(req, 502, "deploy_hook_unreachable", "Could not reach the deploy hook. Please try again.");
  }

  if (!response.ok) {
    console.error(`admin/rebuild: deploy hook responded HTTP ${response.status}`);
    return jsonError(req, 502, "deploy_hook_failed", `The deploy hook responded with an error (HTTP ${response.status}).`);
  }

  return json(req, { message: "Rebuilding. Live in about 2 minutes." });
}
