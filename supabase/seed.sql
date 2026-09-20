-- GENERATED FILE — do not edit by hand.
-- Source: lib/books.ts · Regenerate: npm run seed:books
--
-- Upserts the catalogue. Prices here are what buyers are actually charged;
-- lib/books.ts only decides what the marketing pages display.

insert into public.books (slug, title, price_paise, currency, pdf_path, active)
values
  ('signal-discipline', 'Signal Discipline', 19900, 'INR', 'signal-discipline/signal-discipline.pdf', true),
  ('the-cost-of-being-early', 'The Cost of Being Early', 19900, 'INR', 'the-cost-of-being-early/the-cost-of-being-early.pdf', true),
  ('small-teams-hard-calls', 'Small Teams, Hard Calls', 24900, 'INR', 'small-teams-hard-calls/small-teams-hard-calls.pdf', true),
  ('reading-a-study-in-20-minutes', 'Reading a Study in 20 Minutes', 14900, 'INR', 'reading-a-study-in-20-minutes/reading-a-study-in-20-minutes.pdf', true)
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
 where slug not in ('signal-discipline', 'the-cost-of-being-early', 'small-teams-hard-calls', 'reading-a-study-in-20-minutes');
