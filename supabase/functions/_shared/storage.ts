import { adminClient, type BookRow } from "./supabase.ts";

const BUCKET = "book-files";

/** Ten minutes: long enough to start the download, short enough to be useless if shared. */
export const SIGNED_URL_TTL_SECONDS = 600;

/**
 * Mints a short-lived signed URL for a book's PDF. These are created on demand
 * and never stored or emailed — the buyer's durable credential is the download
 * token, which is exchanged for a fresh URL each visit.
 */
export async function signedPdfUrl(
  book: Pick<BookRow, "pdf_path">,
): Promise<string | null> {
  if (!book.pdf_path) return null;

  const { data, error } = await adminClient()
    .storage
    .from(BUCKET)
    .createSignedUrl(book.pdf_path, SIGNED_URL_TTL_SECONDS);

  if (error || !data) {
    // A missing file is an operations problem, not something to leak to the buyer.
    console.error(`storage: could not sign ${book.pdf_path}`, error);
    return null;
  }
  return data.signedUrl;
}
