-- Additive only: adds an optional "free bonus" PDF (+ its own cover image)
-- to a guide. Every column here is nullable with no default EXCEPT
-- bonus_enabled, which needs a concrete default to be usable in a WHERE
-- clause and to guarantee every existing guide (and every future guide,
-- until an admin explicitly turns this on) behaves exactly as it does
-- today. DEFAULT 0 applies to every existing row instantly, no rewrite.
--
-- bonus_pdf_path is never selected by /api/catalog (see that route's
-- header comment) — stays exactly as private as the main PDF.
--
-- Never touch any existing column in this table — this project has live
-- paying customers.
ALTER TABLE books ADD COLUMN bonus_title TEXT;
ALTER TABLE books ADD COLUMN bonus_description TEXT;
ALTER TABLE books ADD COLUMN bonus_cover_path TEXT;
ALTER TABLE books ADD COLUMN bonus_pdf_path TEXT;
ALTER TABLE books ADD COLUMN bonus_enabled INTEGER NOT NULL DEFAULT 0;
