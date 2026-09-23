// GET /api/download?token=<uuid> — streams the PDF.
//
// The token is the buyer's only credential, so it is treated like one: it
// must belong to a paid order, and it is spent against a download cap in the
// same atomic statement that checks it. There is no Supabase-style signed
// URL step here — R2 has no equivalent, and none is needed: the Worker reads
// the object straight out of the private bucket and streams the bytes back
// with Content-Disposition: attachment, so the bucket itself is never
// reachable except through this route. Ports
// supabase/functions/get-download/index.ts + _shared/storage.ts.
import { isUuid, jsonError, methodNotAllowed } from "../lib/http";
import { claimDownload, getBookBySlug } from "../lib/orders";
import type { WorkerEnv } from "../lib/env";

const DOWNLOAD_LIMIT = 10;

export async function handleDownload(req: Request, env: WorkerEnv): Promise<Response> {
  if (req.method !== "GET") return methodNotAllowed(req, "GET");

  const token = new URL(req.url).searchParams.get("token");
  if (!isUuid(token)) {
    return jsonError(req, 400, "invalid_token", "This download link is not valid.");
  }

  // Atomic: checks paid status and the cap, and spends one download, in one step.
  let claim;
  try {
    claim = await claimDownload(env, token, DOWNLOAD_LIMIT);
  } catch (error) {
    console.error("download: claim failed", error);
    return jsonError(req, 500, "server_error", "Could not open this download. Please try again.");
  }

  if (!claim) {
    // Nothing was spent. Work out which of the two dead ends this is — the
    // holder of a token has earned a useful message.
    const existing = await env.DB
      .prepare(`SELECT status, download_count FROM orders WHERE download_token = ?1`)
      .bind(token)
      .first<{ status: string; download_count: number }>();

    if (existing && existing.status === "paid" && existing.download_count >= DOWNLOAD_LIMIT) {
      return jsonError(
        req,
        429,
        "download_limit_reached",
        `This link has been used its maximum of ${DOWNLOAD_LIMIT} times. Email hello@archivist.in and we will sort it out.`,
      );
    }
    return jsonError(req, 404, "invalid_token", "This download link is not valid.");
  }

  const book = await getBookBySlug(env, claim.book_slug);
  if (!book || !book.pdf_path) {
    console.error(`download: no pdf_path for ${claim.book_slug} (order ${claim.order_id})`);
    return jsonError(req, 500, "file_unavailable", "The file for this book is temporarily unavailable. Please contact support.");
  }

  const object = await env.BOOK_FILES.get(book.pdf_path);
  if (!object) {
    console.error(`download: R2 object missing at ${book.pdf_path} for order ${claim.order_id}`);
    return jsonError(req, 500, "file_unavailable", "The file for this book is temporarily unavailable. Please contact support.");
  }

  const filename = `${claim.book_slug}.pdf`;
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Content-Type", "application/pdf");
  headers.set("Content-Disposition", `attachment; filename="${filename}"`);
  headers.set("Content-Length", String(object.size));
  headers.set("Cache-Control", "private, no-store");
  // No JSON body here (unlike the old get-download) — the response *is* the
  // file. These two headers carry what the old response body used to, in
  // case Phase 4 wants the /download page to show them without a second
  // request: exposed via CORS so the browser's fetch() can read them
  // (plain <a href> downloads ignore headers, so this only matters if the
  // page fetches this route with JS rather than just linking to it).
  headers.set("X-Downloads-Remaining", String(Math.max(DOWNLOAD_LIMIT - claim.download_count, 0)));
  headers.set("X-Book-Title", encodeURIComponent(book.title));
  headers.set("Access-Control-Expose-Headers", "X-Downloads-Remaining, X-Book-Title");

  return new Response(object.body, { status: 200, headers });
}
