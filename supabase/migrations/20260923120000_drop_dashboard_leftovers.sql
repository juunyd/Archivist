-- Removes the parts of the reverted publishing-dashboard schema that no code
-- reads any more. lib/books.ts is the source of truth again (see the revert,
-- "Revert publishing dashboard; books come from code again"), and nothing in
-- supabase/functions ever queries these — checked with:
--
--   grep -rn "<column>" supabase/functions --include="*.ts"
--
-- for each column below; none matched.
--
-- Kept: books.status. create-order still filters on it
-- (supabase/functions/create-order/index.ts) to refuse selling a draft book,
-- so it is live, not a leftover.

-- The view was the dashboard-era public read surface (anon has never been
-- able to read public.books itself). Nothing in app/ or lib/ queries it any
-- more — the static site reads lib/books.ts instead — so it is dead, but it
-- was still live and anon-readable, which is exactly the kind of silent
-- drift risk this migration removes.
drop view if exists public.published_books;

-- That view was the only reason this policy existed: it let the view's
-- owner see published rows despite books' FORCE ROW LEVEL SECURITY. With the
-- view gone, the policy has nothing left to serve.
drop policy if exists books_owner_reads_published on public.books;

-- Only used to stamp updated_at and published_at, both dropped below.
drop trigger if exists books_touch_updated_at on public.books;
drop function if exists public.touch_updated_at();

-- Indexed sort_order, which is dropped below.
drop index if exists public.books_shelf_idx;

-- Shape checks on columns that are dropped below.
alter table public.books
  drop constraint if exists books_whats_inside_is_array,
  drop constraint if exists books_faqs_is_array,
  drop constraint if exists books_page_count_positive,
  drop constraint if exists books_published_is_complete;

-- The display columns themselves: added for the admin dashboard to write and
-- the static build to read through published_books. Nothing writes or reads
-- them now.
alter table public.books
  drop column if exists number,
  drop column if exists subtitle,
  drop column if exists blurb,
  drop column if exists description,
  drop column if exists page_count,
  drop column if exists whats_inside,
  drop column if exists faqs,
  drop column if exists cover_path,
  drop column if exists sort_order,
  drop column if exists published_at,
  drop column if exists updated_at;
