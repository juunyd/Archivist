import { adminClient, type BookRow } from "./supabase.ts";

const BUCKET = "book-files";

/** Ten minutes: long enough to start the download, short enough to be useless if shared. */
export const SIGNED_URL_TTL_SECONDS = 600;

/**
 * Mints a short-lived signed URL for a book's PDF. These are created on demand
 * and never stored or emailed — the buyer's durable credential is the download
 * token, which is exchanged for a fresh URL each visit.
 *
 * `download` makes Storage respond with Content-Disposition: attachment and
 * the given filename. That header is what actually saves the file: the <a
 * download> attribute is ignored on a cross-origin URL, so without this the
 * PDF just opens in the browser's viewer.
 */
export async function signedPdfUrl(
  book: Pick<BookRow, "pdf_path">,
  downloadName: string,
): Promise<string | null> {
  if (!book.pdf_path) return null;

  const { data, error } = await adminClient()
    .storage
    .from(BUCKET)
    .createSignedUrl(book.pdf_path, SIGNED_URL_TTL_SECONDS, {
      download: downloadName,
    });

  if (error || !data) {
    // A missing file is an operations problem, not something to leak to the buyer.
    console.error(`storage: could not sign ${book.pdf_path}`, error);
    return null;
  }
  return data.signedUrl;
}
