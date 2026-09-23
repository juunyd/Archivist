-- Seeds the four books from lib/books.ts. Prices here are what buyers are
-- actually charged (paise); lib/books.ts only decides what the marketing
-- pages display (rupees). Keep the two in step by hand:
--
--   1. edit `price` in lib/books.ts (rupees), and
--   2. edit price_paise below (paise — rupees x 100) and re-run this
--      migration's UPDATE, or apply a new migration with the change.
--
-- Adding or removing a book means doing the same in both places: a slug
-- that is not in this table with status = 'published' renders on the site
-- but cannot be bought.

INSERT INTO books (slug, title, price_paise, currency, pdf_path, status) VALUES
  ('signal-discipline', 'Signal Discipline', 19900, 'INR', 'signal-discipline/signal-discipline.pdf', 'published'),
  ('the-cost-of-being-early', 'The Cost of Being Early', 19900, 'INR', 'the-cost-of-being-early/the-cost-of-being-early.pdf', 'published'),
  ('small-teams-hard-calls', 'Small Teams, Hard Calls', 24900, 'INR', 'small-teams-hard-calls/small-teams-hard-calls.pdf', 'published'),
  ('reading-a-study-in-20-minutes', 'Reading a Study in 20 Minutes', 14900, 'INR', 'reading-a-study-in-20-minutes/reading-a-study-in-20-minutes.pdf', 'published');
