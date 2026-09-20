-- New tables are not auto-exposed to the Data API roles (see
-- `auto_expose_new_tables` in config.toml), so the service role — which is how
-- Edge Functions reach these tables — needs an explicit grant. anon and
-- authenticated deliberately get nothing.

grant usage on schema public to service_role;
grant all privileges on public.books  to service_role;
grant all privileges on public.orders to service_role;

revoke all on public.books  from anon, authenticated;
revoke all on public.orders from anon, authenticated;
