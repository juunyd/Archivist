#!/usr/bin/env node
/**
 * Regenerates the books seed SQL from lib/books.ts, so the catalogue the site
 * renders and the catalogue the database charges from cannot drift apart.
 *
 *   npm run seed:books          rewrite the canonical seed migration + seed.sql
 *   npm run seed:books -- --new also emit a fresh timestamped migration, for
 *                               when the canonical one has already been pushed
 *
 * Requires Node >= 22.18 (imports lib/books.ts directly via type stripping).
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const CANONICAL_MIGRATION = "20260920090300_seed_books.sql";

const { books } = await import(pathToFileURL(join(repoRoot, "lib/books.ts")));

const q = (value) =>
  value === null || value === undefined ? "null" : `'${String(value).replace(/'/g, "''")}'`;

const rows = books.map((book) => {
  const pricePaise = Math.round(book.price * 100);
  if (!Number.isInteger(pricePaise) || pricePaise <= 0) {
    throw new Error(`Book "${book.slug}" has an unusable price: ${book.price}`);
  }
  return `  (${q(book.slug)}, ${q(book.title)}, ${pricePaise}, 'INR', ` +
    `${q(`${book.slug}/${book.slug}.pdf`)}, true)`;
});

const sql = `-- GENERATED FILE — do not edit by hand.
-- Source: lib/books.ts · Regenerate: npm run seed:books
--
-- Upserts the catalogue. Prices here are what buyers are actually charged;
-- lib/books.ts only decides what the marketing pages display.

insert into public.books (slug, title, price_paise, currency, pdf_path, active)
values
${rows.join(",\n")}
on conflict (slug) do update
  set title       = excluded.title,
      price_paise = excluded.price_paise,
      currency    = excluded.currency,
      pdf_path    = excluded.pdf_path,
      active      = excluded.active;

-- Anything no longer in lib/books.ts stops being sellable, but is kept so
-- existing orders still resolve their book.
update public.books
   set active = false
 where slug not in (${books.map((b) => q(b.slug)).join(", ")});
`;

const targets = [
  join(repoRoot, "supabase/migrations", CANONICAL_MIGRATION),
  join(repoRoot, "supabase/seed.sql"),
];

if (process.argv.includes("--new")) {
  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  targets.push(join(repoRoot, "supabase/migrations", `${stamp}_seed_books.sql`));
}

for (const target of targets) {
  writeFileSync(target, sql);
  console.log(`wrote ${target.replace(`${repoRoot}/`, "")}`);
}
console.log(`${books.length} book(s) seeded from lib/books.ts`);
