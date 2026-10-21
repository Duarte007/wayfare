-- A document's file can only be read through a row that really owns it.
--
-- The storage read policy allows a file when a visible documents row has that storage_path. Without
-- more checks, a trip mate could insert (or edit) a row pointing at someone else's private file and
-- read it. This closes that:
--   * a new document always belongs to whoever inserts it (owner_id = auth.uid());
--   * owner_id never changes, and once set, storage_path never changes;
--   * storage_path must be "{owner_id}/{trip_id}/{id}" of the row itself;
--   * the storage read policy also requires the file's folder to be the row owner's.
-- SQLSTATE 42501 is permanent for the client's sync, so a refused change is set aside.
-- Server code without a user (service role, SQL editor) is not restricted.

create or replace function public.guard_document_file()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return new;
  end if;

  if tg_op = 'INSERT' and new.owner_id is distinct from uid then
    raise exception 'A document belongs to whoever adds it'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' then
    if new.owner_id is distinct from old.owner_id then
      raise exception 'A document''s owner cannot be changed' using errcode = '42501';
    end if;
    if old.storage_path is not null and new.storage_path is distinct from old.storage_path then
      raise exception 'A document''s file cannot be swapped' using errcode = '42501';
    end if;
  end if;

  if new.storage_path is not null
     and new.storage_path <> new.owner_id::text || '/' || new.trip_id::text || '/' || new.id::text then
    raise exception 'storage_path must be {owner_id}/{trip_id}/{id}' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_document_file() from public, anon, authenticated;

create trigger documents_guard_file
  before insert or update on public.documents
  for each row execute function public.guard_document_file();

alter policy "documents: visible files read" on storage.objects to authenticated
  using (bucket_id = 'documents'
    and exists (
      select 1 from public.documents d
      where d.storage_path = name
        and d.owner_id::text = (storage.foldername(name))[1]
    ));
