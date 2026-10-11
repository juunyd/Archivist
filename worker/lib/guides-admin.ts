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
}

export interface AdminGuideDetailRow {
  slug: string;
  title: string;
  number: string | null;
  subtitle: string | null;
  blurb: string | null;
  description: string | null;
  price_paise: number;
  compare_at_price_paise: number | null;
  currency: string;
  page_count: number | null;
  chapter_count: number | null;
  whats_inside: string | null;
  faqs: string | null;
  badge: string | null;
  button_text: string | null;
  cover_path: string | null;
  pdf_path: string | null;
  status: "draft" | "published";
  sort_order: number | null;
  created_at: string;
  updated_at: string | null;
}

export async function listAdminGuides(env: WorkerEnv): Promise<AdminGuideListRow[]> {
  const result = await env.DB.prepare(
    `SELECT b.slug AS slug, b.title AS title, b.number AS number,
            b.price_paise AS price_paise, b.compare_at_price_paise AS compare_at_price_paise,
            b.status AS status, b.cover_path AS cover_path, b.pdf_path AS pdf_path,
            b.sort_order AS sort_order,
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
  await env.DB.prepare(
    `INSERT INTO books
       (slug, title, price_paise, currency, status,
        number, subtitle, blurb, description, page_count, chapter_count,
        whats_inside, faqs, badge, button_text, compare_at_price_paise, sort_order, updated_at)
     VALUES
       (?1, ?2, ?3, 'INR', ?4,
        ?5, ?6, ?7, ?8, ?9, ?10,
        ?11, ?12, ?13, ?14, ?15, ?16, ?17)`,
  )
    .bind(
      input.slug,
      input.title,
      input.pricePaise,
      input.status,
      input.number,
      input.subtitle,
      input.blurb,
      input.description,
      input.pageCount,
      input.chapterCount,
      JSON.stringify(input.whatsInside),
      JSON.stringify(input.faqs),
      input.badge,
      input.buttonText,
      input.compareAtPricePaise,
      input.sortOrder,
      nowIso(),
    )
    .run();
}

/** Renames a guide's slug — only ever called after confirming it has zero orders. */
export async function updateGuide(
  env: WorkerEnv,
  currentSlug: string,
  input: ValidatedGuideInput,
): Promise<void> {
  await env.DB.prepare(
    `UPDATE books SET
       slug = ?1, title = ?2, price_paise = ?3, status = ?4,
       number = ?5, subtitle = ?6, blurb = ?7, description = ?8,
       page_count = ?9, chapter_count = ?10, whats_inside = ?11, faqs = ?12,
       badge = ?13, button_text = ?14, compare_at_price_paise = ?15, sort_order = ?16, updated_at = ?17
     WHERE slug = ?18`,
  )
    .bind(
      input.slug,
      input.title,
      input.pricePaise,
      input.status,
      input.number,
      input.subtitle,
      input.blurb,
      input.description,
      input.pageCount,
      input.chapterCount,
      JSON.stringify(input.whatsInside),
      JSON.stringify(input.faqs),
      input.badge,
      input.buttonText,
      input.compareAtPricePaise,
      input.sortOrder,
      nowIso(),
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
    blurb: row.blurb,
    description: row.description,
    pricePaise: row.price_paise,
    compareAtPricePaise: row.compare_at_price_paise,
    currency: row.currency,
    pageCount: row.page_count,
    chapterCount: row.chapter_count,
    whatsInside: parseJsonArray(row.whats_inside),
    faqs: parseJsonArray(row.faqs),
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
  };
}
