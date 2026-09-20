-- Abuse protection for resend-download-link.
--
-- That endpoint answers identically whether or not an email has ever bought
-- anything, so it cannot be used to enumerate customers — but without a cap it
-- could still be used to mail-bomb a real buyer. Three requests per email per
-- hour is plenty for someone who has genuinely lost their link.

create table if not exists public.resend_requests (
  id           bigint generated always as identity primary key,
  email        text        not null,
  requested_at timestamptz not null default now()
);

comment on table public.resend_requests is 'Rate-limit ledger for download link resend requests.';

-- Rows are written for unknown addresses too, so the work done (and therefore
-- the response time) does not reveal whether an email exists in orders.
create index if not exists resend_requests_email_time_idx
  on public.resend_requests (lower(email), requested_at desc);

alter table public.resend_requests enable row level security;
alter table public.resend_requests force row level security;

grant usage on schema public to service_role;
grant all privileges on public.resend_requests to service_role;
grant usage, select on all sequences in schema public to service_role;
revoke all on public.resend_requests from anon, authenticated;
