-- Private bucket for invoice files. Files are evidence: no update or delete for anyone.
-- Path: {supplier_party_id}/{uuid}.{ext}. Clients read through 60-second signed URLs only.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('invoices', 'invoices', false, 5242880, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "invoices bucket: suppliers upload into their own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'invoices'
    and (select private.my_role()) = 'supplier'
    and (storage.foldername(name))[1] = (select private.my_party())::text
  );

-- The owner supplier sees its folder; buyers and staff see a file through the invoice they can see (invoices RLS).
create policy "invoices bucket: owner, the invoice's buyer, staff" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'invoices'
    and (
      (storage.foldername(name))[1] = (select private.my_party())::text
      or exists (select 1 from public.invoices i where i.file_path = objects.name)
    )
  );
