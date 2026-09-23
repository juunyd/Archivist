-- Books catalogue.
--
-- This table is the ONLY source of truth for money. lib/books.ts drives the
-- marketing copy on the static site; what a buyer is actually charged comes
-- from price_paise here, looked up server-side by slug. A tampered client
-- can ask to buy a slug, never to set a price.
--
-- lib/books.ts and this table's seed (0004_seed_books.sql) must be kept in
-- sync by hand: adding, removing or repricing a book means editing both. See
-- the header comment in lib/books.ts for the exact steps.

CREATE TABLE books (
  slug        TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  price_paise INTEGER NOT NULL CHECK (price_paise > 0),
  currency    TEXT NOT NULL DEFAULT 'INR' CHECK (currency = upper(currency)),
  pdf_path    TEXT,
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Mirrors the old books_active_idx: a fast lookup for sellable books.
CREATE INDEX books_published_idx ON books (slug) WHERE status = 'published';
