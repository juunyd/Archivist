-- PDF only.
--
-- Archivist sells a single format now, so the second path column goes rather
-- than lingering as a permanently-null field that new code has to keep
-- remembering to ignore. No order references it — delivery reads pdf_path —
-- so dropping it loses nothing a buyer could ask for.

alter table public.books drop column if exists epub_path;

comment on column public.books.pdf_path is
  'Object path inside the private book-files bucket, e.g. slug/slug.pdf';

-- The bucket stops accepting anything but PDFs. Any .epub already uploaded
-- keeps sitting there unreferenced; delete those by hand if you uploaded some.
update storage.buckets
   set allowed_mime_types = array['application/pdf']
 where id = 'book-files';
