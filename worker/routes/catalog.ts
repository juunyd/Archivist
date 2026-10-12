// GET /api/catalog -> published guides only, for the public shop.
//
// Phase 2 Step A: this endpoint exists and is live, but the Next.js build
// still reads lib/guides.ts directly — nothing depends on this yet. Step B
// switches the build to fetch from here.
//
// Always Cache-Control: no-store. That's deliberate and different from how
// Step B's build-time fetch will call this (cache: "force-cache" on the
// request) — the two are independent: this header stops Cloudflare's edge
// or any browser from caching a live response, while the build's own fetch
// options control whether its *build-time* request is cached. Returning
// no-store here keeps this endpoint trustworthy to poll/test by hand.
//
// Never selects pdf_path, and never returns a draft guide.
import { corsHeaders } from "../lib/cors";
import { jsonError, methodNotAllowed } from "../lib/http";
import type { WorkerEnv } from "../lib/env";

interface CatalogRow {
  slug: string;
  number: string | null;
  title: string;
  subtitle: string | null;
  blurb: string | null;
  description: string | null;
  price_paise: number;
  compare_at_price_paise: number | null;
  page_count: number | null;
  chapter_count: number | null;
  cover_path: string | null;
  badge: string | null;
  button_text: string | null;
  whats_inside: string | null;
  sort_order: number | null;
  bonus_title: string | null;
  bonus_description: string | null;
  bonus_cover_path: string | null;
  bonus_enabled: number;
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

export async function handleCatalog(req: Request, env: WorkerEnv): Promise<Response> {
  if (req.method !== "GET") return methodNotAllowed(req, "GET");

  let result;
  try {
    result = await env.DB
      .prepare(
        `SELECT slug, number, title, subtitle, blurb, description,
                price_paise, compare_at_price_paise, page_count, chapter_count,
                cover_path, badge, button_text, whats_inside, sort_order,
                bonus_title, bonus_description, bonus_cover_path, bonus_enabled
           FROM books
          WHERE status = 'published'
          ORDER BY sort_order ASC, slug ASC`,
      )
      .all<CatalogRow>();
  } catch (error) {
    console.error("catalog: query failed", error);
    return jsonError(req, 500, "server_error", "Could not load the catalogue.");
  }

  const guides = (result.results ?? []).map((row) => ({
    slug: row.slug,
    number: row.number,
    title: row.title,
    subtitle: row.subtitle,
    blurb: row.blurb,
    description: row.description,
    pricePaise: row.price_paise,
    compareAtPricePaise: row.compare_at_price_paise,
    pageCount: row.page_count,
    chapterCount: row.chapter_count,
    coverPath: row.cover_path,
    badge: row.badge,
    buttonText: row.button_text,
    whatsInside: parseJsonArray(row.whats_inside),
    ...(row.bonus_enabled === 1 && row.bonus_title != null && row.bonus_cover_path != null
      ? { bonus: { title: row.bonus_title, description: row.bonus_description, coverPath: row.bonus_cover_path } }
      : {}),
  }));

  return new Response(JSON.stringify({ guides }), {
    status: 200,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
