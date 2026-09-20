-- Orders: one row per checkout attempt.
--
-- The lifecycle is created -> paid -> (fulfilled, emailed), or created ->
-- failed. Both the verify-payment function and the Razorpay webhook can move
-- an order to 'paid', so every transition is written as a conditional update
-- and is safe to replay.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'order_status'
                   and typnamespace = 'public'::regnamespace) then
    create type public.order_status as enum ('created', 'paid', 'failed', 'refunded');
  end if;
end
$$;

create table if not exists public.orders (
  id                  uuid primary key default gen_random_uuid(),
  book_slug           text not null references public.books (slug),
  amount_paise        integer not null check (amount_paise > 0),
  currency            text not null default 'INR',
  status              public.order_status not null default 'created',
  razorpay_order_id   text not null unique,
  razorpay_payment_id text unique,
  buyer_email         text,
  buyer_phone         text,
  download_token      uuid not null unique default gen_random_uuid(),
  download_count      integer not null default 0 check (download_count >= 0),
  created_at          timestamptz not null default now(),
  paid_at             timestamptz,
  fulfilled_at        timestamptz,
  email_sent_at       timestamptz
);

comment on table  public.orders                is 'One row per checkout attempt; amounts are copied from books at creation time.';
comment on column public.orders.download_token is 'Secret handed to the buyer by email; the only credential for /download.';
comment on column public.orders.fulfilled_at   is 'Set exactly once, by a conditional update, so delivery email is sent once.';

create index if not exists orders_buyer_email_idx on public.orders (lower(buyer_email));
create index if not exists orders_status_idx      on public.orders (status);
create index if not exists orders_book_slug_idx   on public.orders (book_slug);
create index if not exists orders_created_at_idx  on public.orders (created_at desc);

alter table public.orders enable row level security;
alter table public.orders force row level security;

revoke all on public.orders from anon, authenticated;
