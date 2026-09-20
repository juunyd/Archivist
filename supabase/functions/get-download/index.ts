// GET ?token=<uuid> -> { bookTitle, pdfUrl, downloadsRemaining }
//
// The token is the buyer's only credential, so it is treated like one: it must
// belong to a paid order, it is spent against a download cap, and it yields
// URLs that expire in ten minutes rather than anything permanent.
import { preflight } from "../_shared/cors.ts";
import { isUuid, json, jsonError, methodNotAllowed } from "../_shared/http.ts";
import { adminClient, type BookRow } from "../_shared/supabase.ts";
import { signedPdfUrl } from "../_shared/storage.ts";

const DOWNLOAD_LIMIT = 10;

Deno.serve(async (req) => {
  const options = preflight(req);
  if (options) return options;
  if (req.method !== "GET") return methodNotAllowed(req, "GET");

  const token = new URL(req.url).searchParams.get("token");
  if (!isUuid(token)) {
    return jsonError(req, 400, "invalid_token", "This download link is not valid.");
  }

  const db = adminClient();

  // Atomic: checks paid status and the cap, and spends one download, in one step.
  const { data, error } = await db.rpc("claim_download", {
    p_token: token,
    p_limit: DOWNLOAD_LIMIT,
  });

  if (error) {
    console.error("get-download: claim_download failed", error);
    return jsonError(req, 500, "server_error", "Could not open this download. Please try again.");
  }

  const claim = (data as { order_id: string; book_slug: string; download_count: number }[])?.[0];

  if (!claim) {
    // Nothing was spent. Work out which of the two dead ends this is — the
    // holder of a token has earned a useful message.
    const { data: existing } = await db
      .from("orders")
      .select("status, download_count")
      .eq("download_token", token)
      .maybeSingle<{ status: string; download_count: number }>();

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

  const { data: book, error: bookError } = await db
    .from("books")
    .select("title, pdf_path")
    .eq("slug", claim.book_slug)
    .maybeSingle<Pick<BookRow, "title" | "pdf_path">>();

  if (bookError || !book) {
    console.error(`get-download: book ${claim.book_slug} missing for order ${claim.order_id}`, bookError);
    return jsonError(req, 500, "server_error", "Could not open this download. Please contact support.");
  }

  const pdfUrl = await signedPdfUrl(book);

  if (!pdfUrl) {
    console.error(`get-download: no signable file for ${claim.book_slug}`);
    return jsonError(req, 500, "file_unavailable", "The file for this book is temporarily unavailable. Please contact support.");
  }

  return json(req, {
    bookTitle: book.title,
    pdfUrl,
    downloadsRemaining: Math.max(DOWNLOAD_LIMIT - claim.download_count, 0),
  });
});
