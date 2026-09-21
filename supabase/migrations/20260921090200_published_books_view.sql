-- The only thing anon can read in this project.
--
-- books itself stays locked (RLS on, forced, no grants to anon). This view is
-- the single public window onto it, and it is deliberately narrow:
--
--   * drafts never appear — the WHERE clause is part of the view, not the query
--   * pdf_path is not selected, so the path to a paid file cannot be read
--   * created_at/updated_at/status stay internal
--
-- The view runs with the privileges of its owner (security_invoker is off by
-- default), which is how it can read a table anon has no grant on. Because
-- books has FORCE ROW LEVEL SECURITY, the owner is subject to policies too, so
-- an explicit policy below lets the view — and only the view's owner — see
-- published rows.

create or replace view public.published_books
with (security_invoker = false) as
  select slug,
         number,
         title,
         subtitle,
         blurb,
         description,
         price_paise,
         currency,
         page_count,
         cover_path,
         whats_inside,
         faqs,
         sort_order,
         published_at
    from public.books
   where status = 'published';

comment on view public.published_books is
  'Public catalogue: published books only, never pdf_path. The static build reads this with the anon key.';

alter view public.published_books owner to postgres;

drop policy if exists books_owner_reads_published on public.books;
create policy books_owner_reads_published on public.books
  for select to postgres
  using (status = 'published');

-- anon/authenticated get the view and nothing else. The grants on books itself
-- are revoked again here so this stays true even if something re-granted them.
grant usage on schema public to anon, authenticated;
grant select on public.published_books to anon, authenticated;
revoke all on public.books from anon, authenticated;
