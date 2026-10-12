/**
 * Guide content and pricing, sourced from D1 via the Worker's /api/catalog —
 * the build-time replacement for the old static lib/guides.ts array.
 *
 * Phase 2 parity-check window: lib/guides.ts still exists, and
 * GUIDES_SOURCE=legacy switches back to it so the same codebase can produce
 * both the old and new static output for the parity diff script
 * (scripts/catalog-parity-check.mjs). Once that diff is clean, lib/guides.ts
 * and the `legacy` branch below are deleted together, in one commit — see
 * that script's header for the exact sequence.
 *
 * Every other export here (Guide, FaqItem, WhatsInsideItem,
 * RESERVED_TOP_LEVEL_PATHS, getAllGuides, getGuideBySlug, getAllGuideSlugs)
 * is permanent — this file is lib/guides.ts's replacement, not a temporary
 * shim.
 */
import { siteConfig } from "@/lib/site";
import { guides as legacyGuides } from "@/lib/guides";

export interface FaqItem {
  question: string;
  answer: string;
}

export interface WhatsInsideItem {
  title: string;
  description: string;
}

export interface Guide {
  slug: string;
  no: string;
  title: string;
  subtitle: string;
  blurb: string;
  problemStatement: string;
  /** Rupees, shown to the visitor. Derived from D1's price_paise — see getAllGuides(). */
  price: number;
  compareAtPrice?: number;
  pageCount?: number;
  chapterCount?: number;
  coverImage: string;
  badge?: string;
  /** Overrides the buy button's label (price is always appended separately — never typed here). Falls back to "Get Instant Access" when unset. */
  buttonText?: string;
  whatsInside: WhatsInsideItem[];
  /** A second, free PDF (with its own cover) included with the purchase — absent when the guide has none. */
  bonus?: {
    title: string;
    description?: string;
    coverImage: string;
  };
}

/**
 * Paths a guide slug must never collide with — everything else that lives
 * at the top level of the site. Checked below so a bad slug fails the build
 * loudly instead of silently shadowing (or being shadowed by) one of these
 * routes. Mirrors the reserved-slug list the admin API validates against in
 * Phase 3 — kept here too since this is where the public build enforces it.
 */
export const RESERVED_TOP_LEVEL_PATHS = [
  "terms",
  "privacy",
  "refund-policy",
  "contact",
  "download",
  "thank-you",
  "api",
  "admin",
  // worker/routes/cover-serve.ts serves every uploaded cover under
  // /covers/* — a guide named "covers" would collide with that route.
  "covers",
];

interface CatalogApiGuide {
  slug: string;
  number: string | null;
  title: string;
  subtitle: string | null;
  blurb: string | null;
  description: string | null;
  pricePaise: number;
  compareAtPricePaise: number | null;
  pageCount: number | null;
  chapterCount: number | null;
  coverPath: string | null;
  badge: string | null;
  buttonText: string | null;
  whatsInside: WhatsInsideItem[];
  bonus?: {
    title: string;
    description: string | null;
    coverPath: string;
  };
}

function assertValidApiGuide(value: unknown): CatalogApiGuide {
  const g = value as Partial<CatalogApiGuide> | null;
  if (
    !g ||
    typeof g.slug !== "string" ||
    typeof g.title !== "string" ||
    typeof g.pricePaise !== "number" ||
    !Array.isArray(g.whatsInside)
  ) {
    throw new Error(`/api/catalog returned a malformed guide: ${JSON.stringify(value)}`);
  }
  return g as CatalogApiGuide;
}

function mapApiGuide(g: CatalogApiGuide): Guide {
  // Two things have to match lib/guides.ts's object literals exactly, not
  // just the values: which optional keys exist at all, and the order they
  // were inserted in. These guides are passed as props into client
  // components (CtaButton, StickyBuyBar, GuideViewTracker), and React's RSC
  // flight serializer (a) represents an own property explicitly set to
  // `undefined` as a "$undefined" sentinel rather than omitting it — so an
  // unset optional field must never be assigned, only left out — and (b)
  // serializes object keys in property-insertion order, so each optional
  // field is spread in at its natural position (matching the Guide
  // interface's field order) rather than assigned afterwards, which would
  // push it to the end. Both are required for
  // scripts/catalog-parity-check.mjs to see byte-identical HTML.
  return {
    slug: g.slug,
    no: g.number ?? "",
    title: g.title,
    subtitle: g.subtitle ?? "",
    blurb: g.blurb ?? "",
    problemStatement: g.description ?? "",
    price: Math.round(g.pricePaise / 100),
    ...(g.compareAtPricePaise != null
      ? { compareAtPrice: Math.round(g.compareAtPricePaise / 100) }
      : {}),
    ...(g.pageCount != null ? { pageCount: g.pageCount } : {}),
    ...(g.chapterCount != null ? { chapterCount: g.chapterCount } : {}),
    coverImage: g.coverPath ?? "",
    ...(g.badge != null ? { badge: g.badge } : {}),
    ...(g.buttonText != null ? { buttonText: g.buttonText } : {}),
    whatsInside: g.whatsInside,
    ...(g.bonus != null
      ? {
          bonus: {
            title: g.bonus.title,
            ...(g.bonus.description != null ? { description: g.bonus.description } : {}),
            coverImage: g.bonus.coverPath,
          },
        }
      : {}),
  };
}

// Changes every time this module is loaded by a fresh build process, so a
// build cache Cloudflare restores from a previous build (see wrangler
// Workers Builds docs) never serves a stale /api/catalog response — the
// header value differs, so it's a different cache key. cache: "force-cache"
// itself is required instead of the default/no-store: a static export
// (output: "export") cannot contain a page backed by an uncached fetch, so
// no-store here would fail the build outright, not just skip caching.
const BUILD_CACHE_BUST = `${Date.now()}`;

async function fetchCatalog(): Promise<Guide[]> {
  const url = `${siteConfig.url}/api/catalog`;

  let response: Response;
  try {
    response = await fetch(url, {
      cache: "force-cache",
      headers: { "x-build-cache-bust": BUILD_CACHE_BUST },
    });
  } catch (error) {
    throw new Error(
      `Could not reach the catalogue at ${url} — the build must fail loudly rather than ship an empty shop. ${String(error)}`,
    );
  }

  if (!response.ok) {
    throw new Error(`Catalogue request to ${url} failed with HTTP ${response.status}.`);
  }

  const body = (await response.json()) as { guides?: unknown[] };
  if (!Array.isArray(body.guides) || body.guides.length === 0) {
    throw new Error(`Catalogue at ${url} returned zero guides — refusing to build an empty shop.`);
  }

  return body.guides.map((g) => mapApiGuide(assertValidApiGuide(g)));
}

function checkReservedSlugs(guides: Guide[]): void {
  for (const guide of guides) {
    if ((RESERVED_TOP_LEVEL_PATHS as string[]).includes(guide.slug)) {
      throw new Error(
        `Guide slug "${guide.slug}" collides with a reserved top-level path (${RESERVED_TOP_LEVEL_PATHS.join(", ")}). Rename the guide's slug.`,
      );
    }
  }
}

let guidesPromise: Promise<Guide[]> | null = null;

function loadGuides(): Promise<Guide[]> {
  if (!guidesPromise) {
    guidesPromise =
      process.env.GUIDES_SOURCE === "legacy"
        ? Promise.resolve(legacyGuides)
        : fetchCatalog();
    guidesPromise = guidesPromise.then((guides) => {
      checkReservedSlugs(guides);
      return guides;
    });
  }
  return guidesPromise;
}

export async function getAllGuides(): Promise<Guide[]> {
  return loadGuides();
}

export async function getGuideBySlug(slug: string): Promise<Guide | undefined> {
  const guides = await loadGuides();
  return guides.find((guide) => guide.slug === slug);
}

export async function getAllGuideSlugs(): Promise<string[]> {
  const guides = await loadGuides();
  return guides.map((guide) => guide.slug);
}
