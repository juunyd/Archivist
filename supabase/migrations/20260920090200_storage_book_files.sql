-- Private bucket holding the deliverable files.
--
-- Layout: {slug}/{slug}.pdf and {slug}/{slug}.epub
--
-- No storage.objects policies are created, so anon and authenticated cannot
-- list, read or write anything here. The only way to a file is a short-lived
-- signed URL minted by the get-download Edge Function with the service role.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'book-files',
  'book-files',
  false,
  104857600, -- 100 MiB
  array['application/pdf', 'application/epub+zip']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
