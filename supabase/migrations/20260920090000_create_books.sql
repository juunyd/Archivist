-- Books catalogue.
--
-- This table is the ONLY source of truth for money. `lib/books.ts` drives the
-- marketing copy on the static site; what a buyer is actually charged comes
-- from `price_paise` here, looked up server-side by slug. A tampered client
-- can ask to buy a slug, never to set a price.

create table if not exists public.books (
  slug        text primary key,
  title       text        not null,
  price_paise integer     not null check (price_paise > 0),
  currency    text        not null default 'INR' check (currency = upper(currency)),
  pdf_path    text,
  epub_path   text,
  active      boolean     not null default true,
  created_at  timestamptz not null default now()
);

comment on table  public.books              is 'Sellable titles. Prices charged come only from here.';
comment on column public.books.price_paise  is 'Charge amount in the smallest currency unit (paise for INR).';
comment on column public.books.pdf_path     is 'Object path inside the private book-files bucket, e.g. slug/slug.pdf';
comment on column public.books.epub_path    is 'Object path inside the private book-files bucket, e.g. slug/slug.epub';
comment on column public.books.active       is 'Inactive books cannot be checked out.';

create index if not exists books_active_idx on public.books (active) where active;

-- RLS on, with no policies at all: anon and authenticated can read nothing.
-- Edge Functions reach this table with the service role key, which bypasses RLS.
alter table public.books enable row level security;
alter table public.books force row level security;

revoke all on public.books from anon, authenticated;
