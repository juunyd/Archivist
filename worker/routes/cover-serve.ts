// GET /covers/{filename} — serves covers uploaded through the admin API
// (Step 2) straight out of the BOOK_FILES bucket's covers/ prefix. Public,
// no requireAccess: a guide's cover is marketing material, same as the
// legacy covers still sitting in public/images/covers/ and served as static
// assets — this route only exists for the ones that now live in R2 instead.
import { jsonError, methodNotAllowed } from "../lib/http";
import type { WorkerEnv } from "../lib/env";

export async function handleCoverServe(req: Request, env: WorkerEnv, filename: string): Promise<Response> {
  if (req.method !== "GET" && req.method !== "HEAD") return methodNotAllowed(req, "GET");

  const object = await env.BOOK_FILES.get(`covers/${filename}`);
  if (!object) return jsonError(req, 404, "not_found", "Cover not found.");

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("ETag", object.httpEtag);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");

  const ifNoneMatch = req.headers.get("If-None-Match");
  if (ifNoneMatch && ifNoneMatch === object.httpEtag) {
    return new Response(null, { status: 304, headers });
  }

  if (req.method === "HEAD") return new Response(null, { status: 200, headers });
  return new Response(object.body, { status: 200, headers });
}
