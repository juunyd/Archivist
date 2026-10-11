// Server-side validation for POST/PUT /api/admin/guides — the client-sent
// body is never trusted beyond this. Never validates price against anything
// the client claims about itself; price_paise here only has to be a sane
// positive integer, the same way create-order never lets a client set its
// own price.
export const RESERVED_SLUGS = [
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
]; // Mirrors lib/catalog.ts's RESERVED_TOP_LEVEL_PATHS — keep both lists in sync by hand.

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface WhatsInsideItemInput {
  title: string;
  description: string;
}

export interface FaqItemInput {
  question: string;
  answer: string;
}

export interface ValidatedGuideInput {
  slug: string;
  title: string;
  subtitle: string;
  blurb: string;
  description: string | null;
  number: string | null;
  pricePaise: number;
  compareAtPricePaise: number | null;
  pageCount: number;
  chapterCount: number;
  whatsInside: WhatsInsideItemInput[];
  faqs: FaqItemInput[];
  badge: string | null;
  status: "draft" | "published";
  sortOrder: number | null;
}

export type GuideValidationResult =
  | { ok: true; value: ValidatedGuideInput }
  | { ok: false; errors: string[] };

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isPositiveInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v > 0;
}

function isStringArrayField(
  items: unknown,
  keys: [string, string],
): items is Record<string, string>[] {
  return (
    Array.isArray(items) &&
    items.length > 0 &&
    items.every(
      (item) =>
        item !== null &&
        typeof item === "object" &&
        isNonEmptyString((item as Record<string, unknown>)[keys[0]]) &&
        isNonEmptyString((item as Record<string, unknown>)[keys[1]]),
    )
  );
}

export function validateGuideInput(body: unknown): GuideValidationResult {
  const errors: string[] = [];
  const b = (body ?? {}) as Record<string, unknown>;

  const slug = typeof b.slug === "string" ? b.slug.trim() : "";
  if (slug.length < 3 || slug.length > 60 || !SLUG_RE.test(slug)) {
    errors.push("slug must be 3-60 characters: lowercase letters, numbers and hyphens only.");
  } else if (RESERVED_SLUGS.includes(slug)) {
    errors.push(`slug "${slug}" is reserved and cannot be used.`);
  }

  if (!isNonEmptyString(b.title)) errors.push("title is required.");
  if (!isNonEmptyString(b.subtitle)) errors.push("subtitle is required.");
  if (!isNonEmptyString(b.blurb)) errors.push("blurb is required.");

  if (!isPositiveInt(b.pricePaise)) errors.push("pricePaise must be a positive integer.");

  let compareAtPricePaise: number | null = null;
  const rawCompareAt = b.compareAtPricePaise;
  if (rawCompareAt !== undefined && rawCompareAt !== null && rawCompareAt !== ("" as unknown)) {
    if (!isPositiveInt(rawCompareAt)) {
      errors.push("compareAtPricePaise must be empty or a positive integer.");
    } else if (isPositiveInt(b.pricePaise) && rawCompareAt <= (b.pricePaise as number)) {
      errors.push("compareAtPricePaise must be greater than pricePaise.");
    } else {
      compareAtPricePaise = rawCompareAt;
    }
  }

  if (!isPositiveInt(b.pageCount)) errors.push("pageCount must be a positive integer.");
  if (!isPositiveInt(b.chapterCount)) errors.push("chapterCount must be a positive integer.");

  if (!isStringArrayField(b.whatsInside, ["title", "description"])) {
    errors.push("whatsInside must be a non-empty array of { title, description } with non-empty strings.");
  }
  if (!isStringArrayField(b.faqs, ["question", "answer"])) {
    errors.push("faqs must be a non-empty array of { question, answer } with non-empty strings.");
  }

  const status = b.status === "published" || b.status === "draft" ? b.status : null;
  if (!status) errors.push('status must be "draft" or "published".');

  let sortOrder: number | null = null;
  if (b.sortOrder !== undefined && b.sortOrder !== null && b.sortOrder !== ("" as unknown)) {
    if (typeof b.sortOrder !== "number" || !Number.isInteger(b.sortOrder)) {
      errors.push("sortOrder must be empty or an integer.");
    } else {
      sortOrder = b.sortOrder;
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      slug,
      title: (b.title as string).trim(),
      subtitle: (b.subtitle as string).trim(),
      blurb: (b.blurb as string).trim(),
      description: isNonEmptyString(b.description) ? (b.description as string).trim() : null,
      number: isNonEmptyString(b.number) ? (b.number as string).trim() : null,
      pricePaise: b.pricePaise as number,
      compareAtPricePaise,
      pageCount: b.pageCount as number,
      chapterCount: b.chapterCount as number,
      whatsInside: b.whatsInside as WhatsInsideItemInput[],
      faqs: b.faqs as FaqItemInput[],
      badge: isNonEmptyString(b.badge) ? (b.badge as string).trim() : null,
      status: status as "draft" | "published",
      sortOrder,
    },
  };
}

/** A guide can only go live once it has both a cover and a PDF uploaded (Step 2). */
export function publishBlockedReason(coverPath: string | null, pdfPath: string | null): string | null {
  const missing: string[] = [];
  if (!coverPath) missing.push("a cover image");
  if (!pdfPath) missing.push("a PDF");
  if (missing.length === 0) return null;
  return `Cannot publish: this guide is missing ${missing.join(" and ")}. Upload ${missing.length > 1 ? "them" : "it"} first.`;
}
