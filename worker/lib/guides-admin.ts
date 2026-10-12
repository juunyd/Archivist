// D1 access for the admin guides API (Phase 3). Separate from lib/orders.ts's
// GuideRow/getGuideBySlug, which are the narrow, checkout-path reads used by
// create-order/download/etc — those must keep working unchanged. Everything
// here is admin-only (gated by requireAccess in the route handlers) and reads
// or writes every column on `books`, including drafts.
import type { WorkerEnv } from "./env";
import type { ValidatedGuideInput } from "./guide-validation";

export interface AdminGuideListRow {
  slug: string;
  title: string;
  number: string | null;
  price_paise: number;
  compare_at_price_paise: number | null;
  status: "draft" | "published";
  cover_path: string | null;
  pdf_path: string | null;
  sort_order: number | null;
  paid_orders: number;
  bonus_enabled: number;
}

export interface AdminGuideDetailRow {
  slug: string;
  title: string;
  number: string | null;
  subtitle: string | null;
  price_paise: number;
  compare_at_price_paise: number | null;
  currency: string;
  page_count: number | null;
  chapter_count: number | null;
  whats_inside: string | null;
  badge: string | null;
  button_text: string | null;
  cover_path: string | null;
  pdf_path: string | null;
  status: "draft" | "published";
  sort_order: number | null;
  created_at: string;
  updated_at: string | null;
  bonus_title: string | null;
  bonus_description: string | null;
  bonus_cover_path: string | null;
  bonus_pdf_path: string | null;
  bonus_enabled: number;
  preview_images: string | null;
}

export interface PreviewImage {
  path: string;
  caption: string | null;
}

export async function listAdminGuides(env: WorkerEnv): Promise<AdminGuideListRow[]> {
  const result = await env.DB.prepare(
    `SELECT b.slug AS slug, b.title AS title, b.number AS number,
            b.price_paise AS price_paise, b.compare_at_price_paise AS compare_at_price_paise,
            b.status AS status, b.cover_path AS cover_path, b.pdf_path AS pdf_path,
            b.sort_order AS sort_order, b.bonus_enabled AS bonus_enabled,
            COUNT(CASE WHEN o.status = 'paid' THEN 1 END) AS paid_orders
       FROM books b
       LEFT JOIN orders o ON o.book_slug = b.slug
      GROUP BY b.slug
      ORDER BY (b.sort_order IS NULL), b.sort_order ASC, b.slug ASC`,
  ).all<AdminGuideListRow>();
  return result.results ?? [];
}

export async function getAdminGuide(env: WorkerEnv, slug: string): Promise<AdminGuideDetailRow | null> {
  return env.DB.prepare(`SELECT * FROM books WHERE slug = ?1`).bind(slug).first<AdminGuideDetailRow>();
}

export async function slugExists(env: WorkerEnv, slug: string): Promise<boolean> {
  const row = await env.DB.prepare(`SELECT 1 FROM books WHERE slug = ?1`).bind(slug).first();
  return row != null;
}

export async function orderCountsForSlug(
  env: WorkerEnv,
  slug: string,
): Promise<{ total: number; paid: number }> {
  const row = await env.DB
    .prepare(
      `SELECT COUNT(*) AS total, COUNT(CASE WHEN status = 'paid' THEN 1 END) AS paid
         FROM orders WHERE book_slug = ?1`,
    )
    .bind(slug)
    .first<{ total: number; paid: number }>();
  return { total: row?.total ?? 0, paid: row?.paid ?? 0 };
}

const nowIso = () => new Date().toISOString();

export async function insertGuide(env: WorkerEnv, input: ValidatedGuideInput): Promise<void> {
  // faqs, blurb and description are deliberately never written here — the
  // admin no longer edits any of them, so a new guide's columns stay NULL
  // (unused) rather than being set to an empty value. See updateGuide's
  // comment for why this also matters on every future save of an existing
  // guide.
  await env.DB.prepare(
    `INSERT INTO books
       (slug, title, price_paise, currency, status,
        number, subtitle, page_count, chapter_count,
        whats_inside, badge, button_text, compare_at_price_paise, sort_order, updated_at,
        bonus_title, bonus_description, bonus_enabled)
     VALUES
       (?1, ?2, ?3, 'INR', ?4,
        ?5, ?6, ?7, ?8,
        ?9, ?10, ?11, ?12, ?13, ?14,
        ?15, ?16, ?17)`,
  )
    .bind(
      input.slug,
      input.title,
      input.pricePaise,
      input.status,
      input.number,
      input.subtitle,
      input.pageCount,
      input.chapterCount,
      JSON.stringify(input.whatsInside),
      input.badge,
      input.buttonText,
      input.compareAtPricePaise,
      input.sortOrder,
      nowIso(),
      input.bonusTitle,
      input.bonusDescription,
      input.bonusEnabled ? 1 : 0,
    )
    .run();
}

/** Renames a guide's slug — only ever called after confirming it has zero orders. */
export async function updateGuide(
  env: WorkerEnv,
  currentSlug: string,
  input: ValidatedGuideInput,
): Promise<void> {
  // faqs, blurb and description are deliberately left out of this UPDATE's
  // column list — the admin no longer edits any of them, and leaving them
  // out of the statement entirely (rather than writing back whatever an
  // empty, blurb/description-less form would imply) is what keeps an
  // existing guide's old data in the database untouched.
  await env.DB.prepare(
    `UPDATE books SET
       slug = ?1, title = ?2, price_paise = ?3, status = ?4,
       number = ?5, subtitle = ?6,
       page_count = ?7, chapter_count = ?8, whats_inside = ?9,
       badge = ?10, button_text = ?11, compare_at_price_paise = ?12, sort_order = ?13, updated_at = ?14,
       bonus_title = ?15, bonus_description = ?16, bonus_enabled = ?17
     WHERE slug = ?18`,
  )
    .bind(
      input.slug,
      input.title,
      input.pricePaise,
      input.status,
      input.number,
      input.subtitle,
      input.pageCount,
      input.chapterCount,
      JSON.stringify(input.whatsInside),
      input.badge,
      input.buttonText,
      input.compareAtPricePaise,
      input.sortOrder,
      nowIso(),
      input.bonusTitle,
      input.bonusDescription,
      input.bonusEnabled ? 1 : 0,
      currentSlug,
    )
    .run();
}

export async function setGuideCoverPath(env: WorkerEnv, slug: string, coverPath: string): Promise<void> {
  await env.DB
    .prepare(`UPDATE books SET cover_path = ?2, updated_at = ?3 WHERE slug = ?1`)
    .bind(slug, coverPath, nowIso())
    .run();
}

export async function setGuidePdfPath(env: WorkerEnv, slug: string, pdfPath: string): Promise<void> {
  await env.DB
    .prepare(`UPDATE books SET pdf_path = ?2, updated_at = ?3 WHERE slug = ?1`)
    .bind(slug, pdfPath, nowIso())
    .run();
}

export async function setGuideBonusCoverPath(env: WorkerEnv, slug: string, coverPath: string): Promise<void> {
  await env.DB
    .prepare(`UPDATE books SET bonus_cover_path = ?2, updated_at = ?3 WHERE slug = ?1`)
    .bind(slug, coverPath, nowIso())
    .run();
}

export async function setGuideBonusPdfPath(env: WorkerEnv, slug: string, pdfPath: string): Promise<void> {
  await env.DB
    .prepare(`UPDATE books SET bonus_pdf_path = ?2, updated_at = ?3 WHERE slug = ?1`)
    .bind(slug, pdfPath, nowIso())
    .run();
}

export async function setGuidePreviewImages(env: WorkerEnv, slug: string, images: PreviewImage[]): Promise<void> {
  await env.DB
    .prepare(`UPDATE books SET preview_images = ?2, updated_at = ?3 WHERE slug = ?1`)
    .bind(slug, JSON.stringify(images), nowIso())
    .run();
}

export function parsePreviewImages(row: AdminGuideDetailRow): PreviewImage[] {
  return parseJsonArray(row.preview_images) as PreviewImage[];
}

export async function unpublishGuide(env: WorkerEnv, slug: string): Promise<boolean> {
  const row = await env.DB
    .prepare(
      `UPDATE books SET status = 'draft', updated_at = ?2 WHERE slug = ?1 RETURNING slug`,
    )
    .bind(slug, nowIso())
    .first<{ slug: string }>();
  return row != null;
}

function parseJsonArray(raw: string | null): unknown[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function serializeGuideDetail(row: AdminGuideDetailRow, paidOrders: number, totalOrders: number) {
  return {
    slug: row.slug,
    title: row.title,
    number: row.number,
    subtitle: row.subtitle,
    pricePaise: row.price_paise,
    compareAtPricePaise: row.compare_at_price_paise,
    currency: row.currency,
    pageCount: row.page_count,
    chapterCount: row.chapter_count,
    whatsInside: parseJsonArray(row.whats_inside),
    badge: row.badge,
    buttonText: row.button_text,
    coverPath: row.cover_path,
    pdfPath: row.pdf_path,
    status: row.status,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    paidOrders,
    totalOrders,
    // The slug is locked by either having orders, or already having a PDF —
    // see worker/routes/admin/guides.ts's PUT handler for why a PDF alone
    // blocks a rename even with zero orders.
    slugLocked: totalOrders > 0 || row.pdf_path != null,
    bonusTitle: row.bonus_title,
    bonusDescription: row.bonus_description,
    bonusCoverPath: row.bonus_cover_path,
    bonusPdfPath: row.bonus_pdf_path,
    bonusEnabled: row.bonus_enabled === 1,
    previewImages: parsePreviewImages(row),
  };
}

export function serializeGuideListRow(row: AdminGuideListRow) {
  return {
    slug: row.slug,
    title: row.title,
    number: row.number,
    pricePaise: row.price_paise,
    compareAtPricePaise: row.compare_at_price_paise,
    status: row.status,
    coverPath: row.cover_path,
    hasPdf: row.pdf_path != null,
    sortOrder: row.sort_order,
    paidOrders: row.paid_orders,
    hasBonus: row.bonus_enabled === 1,
  };
}
