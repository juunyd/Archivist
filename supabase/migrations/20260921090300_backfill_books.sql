-- The catalogue as it stood in lib/books.ts, moved into the table it should
-- always have lived in. After this migration that file is deleted and the
-- database is the only place the shop's copy exists.
--
-- Covers are not set here: a migration cannot upload an image. Upload each
-- cover to the public covers bucket and set cover_path, either from the admin
-- UI or with the Supabase CLI (see ADMIN.md). A book without a cover renders a
-- placeholder rather than a broken image.

insert into public.books (
  slug, number, title, subtitle, blurb, description,
  price_paise, currency, page_count, whats_inside, faqs,
  pdf_path, sort_order, status
)
values
  ('signal-discipline',
   'No. 07',
   'Signal Discipline',
   'A field manual for making sharp decisions when your information is noisy, partial and rushed.',
   'Making sharp decisions when your information is noisy, partial and rushed.',
   'You''re not short on information. You''re short on a way to tell what matters.',
   19900,
   'INR',
   148,
   '[{"title":"The evidence ladder","body":"Rank every claim by how it was produced, before arguing about whether it''s true."},{"title":"Five-minute premortem","body":"A short script that surfaces the failure modes your team is quietly avoiding naming."},{"title":"Confidence in writing","body":"State what you believe, how sure you are, and what would change your mind, in three lines."},{"title":"The reversal test","body":"A one-question check separating decisions worth debating from decisions worth simply making."}]'::jsonb,
   '[{"q":"What format do I get?","a":"A print-ready PDF, delivered to your inbox within a minute of checkout. Read it on a phone, laptop or tablet, or print it."},{"q":"What if I want a refund?","a":"Digital files are delivered instantly, so purchases are not refundable. If you were charged twice, or the book never arrived, write to hello@archivist.in and we will refund you in full."},{"q":"Is it a one-time payment?","a":"Yes — one payment, no subscription. You get lifetime access including future editions."},{"q":"Can I get a receipt for expenses?","a":"Yes, a receipt is emailed automatically and can be addressed to a company name at checkout."}]'::jsonb,
   'signal-discipline/signal-discipline.pdf',
   1,
   'published'),
  ('the-cost-of-being-early',
   'No. 06',
   'The Cost of Being Early',
   'What the research actually says about timing a market, a career, or a launch.',
   'What the research actually says about timing a market, a career, or a launch.',
   'Being early feels like foresight. The data says it usually isn''t.',
   19900,
   'INR',
   132,
   '[{"title":"The timing myth","body":"Why being first is remembered and being right is not — and how to tell them apart in your own decisions."},{"title":"The waiting cost model","body":"A simple way to price the cost of moving too soon against the cost of moving too late."},{"title":"Reading the market''s patience","body":"Signals that tell you whether an audience, a market, or an organization is actually ready."},{"title":"The re-entry plan","body":"What to do when you''ve moved early and need a credible way back in without losing face."}]'::jsonb,
   '[{"q":"What format do I get?","a":"A print-ready PDF, delivered to your inbox within a minute of checkout. Read it on a phone, laptop or tablet, or print it."},{"q":"What if I want a refund?","a":"Digital files are delivered instantly, so purchases are not refundable. If you were charged twice, or the book never arrived, write to hello@archivist.in and we will refund you in full."},{"q":"Is it a one-time payment?","a":"Yes — one payment, no subscription. You get lifetime access including future editions."},{"q":"Can I get a receipt for expenses?","a":"Yes, a receipt is emailed automatically and can be addressed to a company name at checkout."}]'::jsonb,
   'the-cost-of-being-early/the-cost-of-being-early.pdf',
   2,
   'published'),
  ('small-teams-hard-calls',
   'No. 05',
   'Small Teams, Hard Calls',
   'How groups of under twelve people decide well, and where they reliably fail.',
   'How groups of under twelve people decide well, and where they reliably fail.',
   'Small teams don''t fail from bad ideas. They fail from bad decision processes.',
   24900,
   'INR',
   164,
   '[{"title":"The consensus trap","body":"Why seeking agreement from everyone quietly produces worse decisions than a clear owner would."},{"title":"The disagree-and-commit script","body":"A concrete way to close a debate without pretending everyone agrees."},{"title":"Decision rights, on paper","body":"A one-page format for who decides what, so it stops being renegotiated every time."},{"title":"The blast-radius check","body":"A quick test for whether a call deserves a meeting or just needs to be made."}]'::jsonb,
   '[{"q":"What format do I get?","a":"A print-ready PDF, delivered to your inbox within a minute of checkout. Read it on a phone, laptop or tablet, or print it."},{"q":"What if I want a refund?","a":"Digital files are delivered instantly, so purchases are not refundable. If you were charged twice, or the book never arrived, write to hello@archivist.in and we will refund you in full."},{"q":"Is it a one-time payment?","a":"Yes — one payment, no subscription. You get lifetime access including future editions."},{"q":"Can I get a receipt for expenses?","a":"Yes, a receipt is emailed automatically and can be addressed to a company name at checkout."}]'::jsonb,
   'small-teams-hard-calls/small-teams-hard-calls.pdf',
   3,
   'published'),
  ('reading-a-study-in-20-minutes',
   'No. 04',
   'Reading a Study in 20 Minutes',
   'A practical method for judging a paper you are not qualified to referee.',
   'A practical method for judging a paper you are not qualified to referee.',
   'You don''t need a PhD to catch a bad study. You need a checklist.',
   14900,
   'INR',
   120,
   '[{"title":"The five-question filter","body":"What to check first, before reading a single line of the results section."},{"title":"Sample size, honestly","body":"How to tell whether a study''s sample can actually support its headline claim."},{"title":"Spotting a p-hacked result","body":"Common tells that a result was found rather than tested for."},{"title":"The one-paragraph verdict","body":"A format for writing down what a study does and doesn''t show you, in three lines."}]'::jsonb,
   '[{"q":"What format do I get?","a":"A print-ready PDF, delivered to your inbox within a minute of checkout. Read it on a phone, laptop or tablet, or print it."},{"q":"What if I want a refund?","a":"Digital files are delivered instantly, so purchases are not refundable. If you were charged twice, or the book never arrived, write to hello@archivist.in and we will refund you in full."},{"q":"Is it a one-time payment?","a":"Yes — one payment, no subscription. You get lifetime access including future editions."},{"q":"Can I get a receipt for expenses?","a":"Yes, a receipt is emailed automatically and can be addressed to a company name at checkout."}]'::jsonb,
   'reading-a-study-in-20-minutes/reading-a-study-in-20-minutes.pdf',
   4,
   'published')
on conflict (slug) do update
  set number       = excluded.number,
      title        = excluded.title,
      subtitle     = excluded.subtitle,
      blurb        = excluded.blurb,
      description  = excluded.description,
      price_paise  = excluded.price_paise,
      currency     = excluded.currency,
      page_count   = excluded.page_count,
      whats_inside = excluded.whats_inside,
      faqs         = excluded.faqs,
      pdf_path     = excluded.pdf_path,
      sort_order   = excluded.sort_order,
      status       = excluded.status;

-- Added only now it can pass: the rows above were 'published' before they had
-- a subtitle or a page count, so the check could not be created with the rest
-- of the schema. From here on, a book cannot be published half-written.
alter table public.books
  drop constraint if exists books_published_is_complete,
  add  constraint books_published_is_complete check (
    status = 'draft' or (
      nullif(trim(title), '')    is not null and
      nullif(trim(subtitle), '') is not null and
      nullif(trim(blurb), '')    is not null and
      page_count is not null
    )
  );
