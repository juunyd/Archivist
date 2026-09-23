-- The admin dashboard was abandoned; its allowlist goes with it.
--
-- `if exists` because 20260923090000_create_admins.sql may never have been
-- pushed — the two migrations are a no-op pair on a database that never saw
-- the first one, and a clean removal on one that did.
--
-- Nothing else from that work is reverted: books.status, the published_books
-- view and the covers bucket all stay. create-order still sells only books
-- with status = 'published'.

drop table if exists public.admins;
