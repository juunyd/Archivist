-- Atomically spends one download against an order.
--
-- Doing this as read-then-write from the function would let two concurrent
-- clicks both read count = 9 and both proceed. A single UPDATE ... RETURNING
-- with the limit in the predicate makes the check and the increment one
-- indivisible step, so the eleventh attempt always loses.

create or replace function public.claim_download(p_token uuid, p_limit integer)
returns table (
  order_id       uuid,
  book_slug      text,
  download_count integer
)
language sql
volatile
security invoker
set search_path = public
as $$
  update public.orders
     set download_count = orders.download_count + 1
   where orders.download_token = p_token
     and orders.status = 'paid'
     and orders.download_count < p_limit
  returning orders.id, orders.book_slug, orders.download_count;
$$;

comment on function public.claim_download(uuid, integer) is
  'Increments download_count for a paid order if under the limit; returns no rows otherwise.';

revoke all on function public.claim_download(uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_download(uuid, integer) to service_role;
