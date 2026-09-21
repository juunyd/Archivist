-- Public bucket holding book cover images.
--
-- Layout: {slug}/{filename}
--
-- Unlike book-files, this bucket is public: covers are marketing assets shown
-- to everyone, and a static site cannot mint signed URLs at request time. Being
-- public grants anonymous READ only — no storage.objects policies are created,
-- so anon and authenticated still cannot upload, overwrite or delete anything.
-- Uploads happen through admin Edge Functions with the service role.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'covers',
  'covers',
  true,
  5242880, -- 5 MiB
  array['image/webp', 'image/png', 'image/jpeg']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
