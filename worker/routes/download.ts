// GET /api/download?token=<uuid> — streams the PDF.
//
// The token is the buyer's only credential, so it is treated like one: it
// must belong to a paid order, and it is spent against a download cap in the
// same atomic statement that checks it. There is no Supabase-style signed
// URL step here — R2 has no equivalent, and none is needed: the Worker reads
// the object straight out of the private bucket and streams the bytes back
// with Content-Disposition: attachment, so the bucket itself is never
// reachable except through this route. Ports
// the old Supabase Edge Functions.
import { isUuid, jsonError, methodNotAllowed } from "../lib/http";
import {
  claimDownload,
  getGuideBySlug,
  findOrderByDownloadToken,
  resolveBonusEligible,
  grantBonusIfEligible,
} from "../lib/orders";
import type { WorkerEnv } from "../lib/env";

const DOWNLOAD_LIMIT = 10;

export async function handleDownload(req: Request, env: WorkerEnv): Promise<Response> {
  if (req.method !== "GET") return methodNotAllowed(req, "GET");

  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!isUuid(token)) {
    return jsonError(req, 400, "invalid_token", "This download link is not valid.");
  }

  if (url.searchParams.get("file") === "bonus") {
    return handleBonusDownload(req, env, token);
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

  const guide = await getGuideBySlug(env, claim.book_slug);
  if (!guide || !guide.pdf_path) {
    console.error(`download: no pdf_path for ${claim.book_slug} (order ${claim.order_id})`);
    return jsonError(req, 500, "file_unavailable", "The file for this guide is temporarily unavailable. Please contact support.");
  }

  const object = await env.BOOK_FILES.get(guide.pdf_path);
  if (!object) {
    console.error(`download: R2 object missing at ${guide.pdf_path} for order ${claim.order_id}`);
    return jsonError(req, 500, "file_unavailable", "The file for this guide is temporarily unavailable. Please contact support.");
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
  headers.set("X-Guide-Title", encodeURIComponent(guide.title));
  let exposeHeaders = "X-Downloads-Remaining, X-Guide-Title";

  // Piggyback the bonus eligibility check on the main, mandatory fetch — this
  // is the only place the /download page learns whether to render the
  // click-to-fetch bonus button, without spending a bonus claim just to find
  // out. A guide with no bonus (or an ineligible order) gets no header,
  // byte-identical to today.
  const bonusEligible = resolveBonusEligible({
    bonusGranted: claim.bonus_granted,
    bonusEnabled: guide.bonus_enabled === 1,
    bonusPdfPath: guide.bonus_pdf_path,
  });
  await grantBonusIfEligible(env, claim.order_id, bonusEligible);
  if (bonusEligible && guide.bonus_title) {
    headers.set("X-Bonus-Title", encodeURIComponent(guide.bonus_title));
    exposeHeaders += ", X-Bonus-Title";
  }
  headers.set("Access-Control-Expose-Headers", exposeHeaders);

  return new Response(object.body, { status: 200, headers });
}

/**
 * GET /api/download?token=<uuid>&file=bonus — the buyer's free bonus PDF.
 * Same token, same shared download_count/cap as the main guide (claimed via
 * the same claimDownload()), just a separate request so the main guide's
 * download is never affected by a problem fetching the bonus. R2 existence
 * is checked BEFORE spending a download, so a missing bonus file costs the
 * buyer nothing.
 */
async function handleBonusDownload(req: Request, env: WorkerEnv, token: string): Promise<Response> {
  const order = await findOrderByDownloadToken(env, token);
  if (!order || order.status !== "paid") {
    return jsonError(req, 404, "invalid_token", "This download link is not valid.");
  }

  const guide = await getGuideBySlug(env, order.book_slug);
  const eligible =
    guide != null &&
    resolveBonusEligible({
      bonusGranted: order.bonus_granted,
      bonusEnabled: guide.bonus_enabled === 1,
      bonusPdfPath: guide.bonus_pdf_path,
    });
  if (!guide || !eligible) {
    return jsonError(req, 404, "bonus_not_available", "There is no free bonus available for this order.");
  }
  await grantBonusIfEligible(env, order.id, true);

  const object = guide.bonus_pdf_path ? await env.BOOK_FILES.get(guide.bonus_pdf_path) : null;
  if (!object) {
    console.error(`download: bonus R2 object missing for ${order.book_slug} (order ${order.id})`);
    return jsonError(
      req,
      404,
      "bonus_file_unavailable",
      "The free bonus is temporarily unavailable. The guide itself is unaffected — please contact support if this persists.",
    );
  }

  let claim;
  try {
    claim = await claimDownload(env, token, DOWNLOAD_LIMIT);
  } catch (error) {
    console.error("download: bonus claim failed", error);
    return jsonError(req, 500, "server_error", "Could not open the bonus download. Please try again.");
  }
  if (!claim) {
    return jsonError(
      req,
      429,
      "download_limit_reached",
      `This link has been used its maximum of ${DOWNLOAD_LIMIT} times. Email hello@archivist.in and we will sort it out.`,
    );
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Content-Type", "application/pdf");
  headers.set("Content-Disposition", `attachment; filename="${order.book_slug}-bonus.pdf"`);
  headers.set("Content-Length", String(object.size));
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Downloads-Remaining", String(Math.max(DOWNLOAD_LIMIT - claim.download_count, 0)));
  headers.set("Access-Control-Expose-Headers", "X-Downloads-Remaining");

  return new Response(object.body, { status: 200, headers });
}
