-- Looks up what an address has bought, one row per book.
--
-- Matching happens on lower(buyer_email) here rather than through a pattern
-- match from the function, so an address containing % or _ cannot turn into a
-- wildcard that returns somebody else's orders. Uses orders_buyer_email_idx.

create or replace function public.paid_orders_for_email(p_email text)
returns table (
  book_slug      text,
  book_title     text,
  download_token uuid,
  paid_at        timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select distinct on (o.book_slug)
         o.book_slug,
         b.title,
         o.download_token,
         o.paid_at
    from public.orders o
    join public.books  b on b.slug = o.book_slug
   where lower(o.buyer_email) = lower(trim(p_email))
     and o.status = 'paid'
   order by o.book_slug, o.paid_at desc nulls last;
$$;

comment on function public.paid_orders_for_email(text) is
  'One row per book bought by this address, newest order per book.';

revoke all on function public.paid_orders_for_email(text) from public, anon, authenticated;
grant execute on function public.paid_orders_for_email(text) to service_role;
