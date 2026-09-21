/**
 * The shop's catalogue, read from Supabase at build time.
 *
 * There is no server at runtime — this is a static export — so every book page
 * is rendered during `next build` from what the database says then. Publishing
 * a change therefore means rebuilding the site, which is what the admin
 * dashboard's "Publish changes" button does.
 *
 * Only `published_books` is readable with the anon key, and that view exposes
 * neither drafts nor `pdf_path`. Nothing secret reaches the browser bundle.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Unique to this build. Set by next.config.js and inlined at compile time, so
 * every render worker agrees on it; the fallback only matters if that inlining
 * ever stops happening, and errs towards fetching too often rather than
 * serving a stale shop. Do not destructure `process.env` here — the value is
 * substituted literally.
 */
const BUILD_REVISION =
  process.env.CATALOGUE_REVISION ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export interface WhatsInsideItem {
  title: string;
  body: string;
}

/**
 * Stored as {q, a}; exposed as {question, answer} because that is the contract
 * FaqAccordion already has with the hand-written FAQs in lib/site.ts.
 */
export interface FaqItem {
  question: string;
  answer: string;
}

export interface Book {
  slug: string;
  /** Shelf number as displayed, e.g. "No. 07". */
  no: string;
  title: string;
  subtitle: string;
  blurb: string;
  /** The problem the book solves, shown above "What's inside". */
  description: string;
  /** Rupees, for display only. What a buyer is charged comes from the database. */
  price: number;
  pageCount: number;
  /** Absolute URL into the public covers bucket, or null when none is uploaded. */
  coverUrl: string | null;
  whatsInside: WhatsInsideItem[];
  faqs: FaqItem[];
}

interface PublishedBookRow {
  slug: string;
  number: string | null;
  title: string;
  subtitle: string | null;
  blurb: string | null;
  description: string | null;
  price_paise: number;
  currency: string;
  page_count: number | null;
  cover_path: string | null;
  whats_inside: unknown;
  faqs: unknown;
  sort_order: number;
  published_at: string | null;
}

class CatalogueError extends Error {
  constructor(message: string) {
    super(
      `${message}\n\n` +
        "The shop's contents come from Supabase at build time, so the build is " +
        "stopped rather than deploying a site with an empty or partial shelf.",
    );
    this.name = "CatalogueError";
  }
}

function coverUrlFor(path: string | null): string | null {
  if (!path) return null;
  const base = (SUPABASE_URL as string).replace(/\/+$/, "");
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${base}/storage/v1/object/public/covers/${encoded}`;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toWhatsInside(value: unknown): WhatsInsideItem[] {
  return asArray(value)
    .map((item) => item as { title?: unknown; body?: unknown })
    .filter((item) => typeof item.title === "string" && typeof item.body === "string")
    .map((item) => ({ title: item.title as string, body: item.body as string }));
}

function toFaqs(value: unknown): FaqItem[] {
  return asArray(value)
    .map((item) => item as { q?: unknown; a?: unknown })
    .filter((item) => typeof item.q === "string" && typeof item.a === "string")
    .map((item) => ({ question: item.q as string, answer: item.a as string }));
}

function toBook(row: PublishedBookRow): Book {
  return {
    slug: row.slug,
    no: row.number ?? "",
    title: row.title,
    subtitle: row.subtitle ?? "",
    blurb: row.blurb ?? "",
    description: row.description ?? "",
    price: Math.round(row.price_paise) / 100,
    pageCount: row.page_count ?? 0,
    coverUrl: coverUrlFor(row.cover_path),
    whatsInside: toWhatsInside(row.whats_inside),
    faqs: toFaqs(row.faqs),
  };
}

async function fetchPublishedBooks(): Promise<Book[]> {
  if (!SUPABASE_URL || !ANON_KEY) {
    throw new CatalogueError(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set to build this site.",
    );
  }

  const url =
    `${SUPABASE_URL.replace(/\/+$/, "")}/rest/v1/published_books` +
    "?select=*&order=sort_order.asc,slug.asc";

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
        Accept: "application/json",
        // Ignored by PostgREST, but part of Next's fetch-cache key — see
        // BUILD_REVISION above. It cannot go in the query string: PostgREST
        // reads unknown query parameters as column filters and would 400.
        "X-Archivist-Build": BUILD_REVISION,
      },
      // Cacheable, so the route stays statically prerenderable under
      // `output: "export"` and the other pages in this build reuse this one
      // response. Freshness across builds comes from the header above, not
      // from opting out of the cache.
      cache: "force-cache",
    });
  } catch (error) {
    throw new CatalogueError(`Could not reach Supabase at ${SUPABASE_URL}: ${String(error)}`);
  }

  if (!response.ok) {
    throw new CatalogueError(
      `Supabase returned ${response.status} for published_books: ${await response.text()}`,
    );
  }

  const rows = (await response.json()) as PublishedBookRow[];
  if (!Array.isArray(rows)) {
    throw new CatalogueError("Supabase returned something that is not a list of books.");
  }
  if (rows.length === 0) {
    throw new CatalogueError("Supabase returned no published books.");
  }

  return rows.map(toBook);
}

/**
 * One request per build, however many pages ask for the catalogue. The promise
 * is cached rather than the result, so concurrent page renders share the same
 * in-flight request.
 */
let pending: Promise<Book[]> | null = null;

export function getPublishedBooks(): Promise<Book[]> {
  if (!pending) {
    pending = fetchPublishedBooks().catch((error) => {
      // Let the next call retry rather than replaying a cached failure.
      pending = null;
      throw error;
    });
  }
  return pending;
}

export async function getBookBySlug(slug: string): Promise<Book | undefined> {
  const books = await getPublishedBooks();
  return books.find((book) => book.slug === slug);
}

export async function getAllBookSlugs(): Promise<string[]> {
  const books = await getPublishedBooks();
  return books.map((book) => book.slug);
}
