-- Additive only: adds the marketing-content columns the admin dashboard and
-- /api/catalog will need, so D1 can become the source of truth for guide
-- content (lib/guides.ts stays the source of truth for price_paise, which is
-- NOT touched by this migration — see that file's header).
--
-- Every column is nullable with no default, which is what SQLite's
-- ALTER TABLE ADD COLUMN requires to be a pure schema change with no risk to
-- the three existing rows in `orders` or the four in `books` — nothing here
-- can fail, lock, or change any value that already exists. 0008 fills these
-- in for the four current guides; new columns are NULL until then.
--
-- Never drop, rename, or modify an existing column in this table, and never
-- touch `orders` — this project has live paying customers.

ALTER TABLE books ADD COLUMN number TEXT;
ALTER TABLE books ADD COLUMN subtitle TEXT;
ALTER TABLE books ADD COLUMN blurb TEXT;
-- Maps to lib/guides.ts's `problemStatement` — named `description` here to
-- match the admin dashboard's field, kept distinct from `blurb` (the short
-- shelf-card line) and `subtitle` (the hero line).
ALTER TABLE books ADD COLUMN description TEXT;
ALTER TABLE books ADD COLUMN page_count INTEGER;
ALTER TABLE books ADD COLUMN chapter_count INTEGER;
ALTER TABLE books ADD COLUMN whats_inside TEXT; -- JSON array of {title, description}
ALTER TABLE books ADD COLUMN faqs TEXT; -- JSON array of {question, answer}
ALTER TABLE books ADD COLUMN badge TEXT;
-- Paise, display-only "was" price — mirrors lib/guides.ts's `compareAtPrice`
-- (rupees). Never charged; price_paise is still the only charging price.
ALTER TABLE books ADD COLUMN compare_at_price_paise INTEGER;
-- Existing public/images/covers/*.png path, unchanged — Phase 3 moves covers
-- to R2 and starts writing new values here; this migration just gives the
-- current path somewhere to live in D1.
ALTER TABLE books ADD COLUMN cover_path TEXT;
ALTER TABLE books ADD COLUMN sort_order INTEGER;
ALTER TABLE books ADD COLUMN updated_at TEXT;
