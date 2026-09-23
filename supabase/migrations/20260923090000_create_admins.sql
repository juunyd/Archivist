-- The allowlist. Being signed in is not being an administrator.
--
-- Supabase Auth will happily issue a valid JWT to any user row that exists, so
-- a token on its own proves only "this is somebody". Every admin Edge Function
-- takes the user id out of the verified token and looks it up here before
-- doing anything. There is no role claim to forge: membership is a row.
--
-- Add yourself by creating a user in the Supabase dashboard and inserting its
-- id here (ADMIN.md has the steps). Public sign-up is disabled, so no one can
-- create an account in the first place.

create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.admins is
  'Allowlist of Supabase Auth users permitted to use the admin Edge Functions.';

-- RLS on with no policies: anon and authenticated can read nothing here, so a
-- signed-in browser cannot even discover who the administrators are. Only the
-- service role, inside an Edge Function, ever reads this table.
alter table public.admins enable row level security;
alter table public.admins force row level security;

grant all privileges on public.admins to service_role;
revoke all on public.admins from anon, authenticated;
