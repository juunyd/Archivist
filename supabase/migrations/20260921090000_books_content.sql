-- The books table becomes the single source of truth for the shop.
--
-- Until now it held only what was needed to charge for a book; everything a
-- visitor actually reads lived in lib/books.ts and was compiled into the site.
-- That file is going away, so every display field moves here. The static build
-- reads them through the published_books view; the admin UI writes them through
-- Edge Functions.

-- Draft books are invisible: they are not sold, not listed, not fetchable by
-- anon. `active` said the same thing with less room to grow, so it is replaced
-- rather than kept alongside.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'book_status'
                   and typnamespace = 'public'::regnamespace) then
    create type public.book_status as enum ('draft', 'published');
  end if;
end
$$;

alter table public.books
  add column if not exists number       text,
  add column if not exists subtitle     text,
  add column if not exists blurb        text,
  add column if not exists description  text,
  add column if not exists page_count   integer,
  add column if not exists whats_inside jsonb       not null default '[]'::jsonb,
  add column if not exists faqs         jsonb       not null default '[]'::jsonb,
  add column if not exists cover_path   text,
  add column if not exists status       public.book_status not null default 'draft',
  add column if not exists sort_order   integer     not null default 0,
  add column if not exists published_at timestamptz,
  add column if not exists updated_at   timestamptz not null default now();

-- Existing rows predate `status`; anything that was sellable stays sellable.
update public.books
   set status       = 'published',
       published_at = coalesce(published_at, created_at)
 where active
   and status = 'draft';

alter table public.books drop column if exists active;

comment on column public.books.number       is 'Shelf number as displayed, e.g. "No. 07".';
comment on column public.books.subtitle     is 'One-line positioning under the title.';
comment on column public.books.blurb        is 'Short line shown on the homepage shelf card.';
comment on column public.books.description  is 'The problem the book solves, shown above "What''s inside".';
comment on column public.books.whats_inside is 'jsonb array of {"title","body"} objects, in display order.';
comment on column public.books.faqs         is 'jsonb array of {"q","a"} objects, in display order.';
comment on column public.books.cover_path   is 'Object path inside the PUBLIC covers bucket, e.g. slug/cover.webp';
comment on column public.books.status       is 'Only published books are sold or exposed to anon.';
comment on column public.books.sort_order   is 'Ascending display order on the shelf.';
comment on column public.books.published_at is 'First time this book went from draft to published.';

-- Shape checks, so a malformed write is rejected at the database rather than
-- rendering as an empty section on a live page.
alter table public.books
  drop constraint if exists books_whats_inside_is_array,
  add  constraint books_whats_inside_is_array check (jsonb_typeof(whats_inside) = 'array');

alter table public.books
  drop constraint if exists books_faqs_is_array,
  add  constraint books_faqs_is_array check (jsonb_typeof(faqs) = 'array');

alter table public.books
  drop constraint if exists books_page_count_positive,
  add  constraint books_page_count_positive check (page_count is null or page_count > 0);

alter table public.books
  drop constraint if exists books_slug_format,
  add  constraint books_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 80);

drop index if exists public.books_active_idx;
create index if not exists books_shelf_idx
  on public.books (sort_order, slug) where status = 'published';

-- Every write stamps updated_at, including writes that forget to.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  -- Going public for the first time is recorded once and never moved by later edits.
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists books_touch_updated_at on public.books;
create trigger books_touch_updated_at
  before insert or update on public.books
  for each row execute function public.touch_updated_at();
