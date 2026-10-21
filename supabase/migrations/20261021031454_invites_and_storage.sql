-- Trip invite links and the private documents bucket.

-- Invites: a link with a random token; only its SHA-256 is stored.
create table public.trip_invites (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  token_hash text not null unique,
  role text not null default 'editor' check (role in ('editor', 'viewer')),
  created_by uuid not null default auth.uid() references auth.users (id),
  expires_at timestamptz not null default now() + interval '7 days',
  max_uses int not null default 10,
  uses int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.trip_invites enable row level security;
create policy "invites: editors read" on public.trip_invites for select
  using (public.is_trip_member(trip_id, true));
create policy "invites: editors revoke" on public.trip_invites for delete
  using (public.is_trip_member(trip_id, true));

create or replace function public.create_trip_invite(p_trip_id uuid, p_role text default 'editor')
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  token text := encode(extensions.gen_random_bytes(18), 'base64');
begin
  if not public.is_trip_member(p_trip_id, true) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  token := translate(token, '+/=', '-_');
  insert into public.trip_invites (trip_id, token_hash, role)
  values (p_trip_id, encode(extensions.digest(token, 'sha256'), 'hex'), p_role);
  return token;
end;
$$;

create or replace function public.accept_trip_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.trip_invites;
begin
  select * into inv from public.trip_invites
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  for update;
  if inv.id is null or inv.expires_at < now() or inv.uses >= inv.max_uses then
    raise exception 'invite invalid or expired' using errcode = 'P0002';
  end if;
  insert into public.trip_members (trip_id, user_id, role)
  values (inv.trip_id, auth.uid(), inv.role)
  on conflict (trip_id, user_id) do nothing;
  update public.trip_invites set uses = uses + 1 where id = inv.id;
  return inv.trip_id;
end;
$$;

-- Functions are executable by PUBLIC by default; only signed-in users may call these.
revoke execute on function public.create_trip_invite(uuid, text) from public, anon;
revoke execute on function public.accept_trip_invite(text) from public, anon;
grant execute on function public.create_trip_invite(uuid, text) to authenticated;
grant execute on function public.accept_trip_invite(text) to authenticated;

-- Storage: private bucket, path {owner_id}/{trip_id}/{document_id} --------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 20971520,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp'])
on conflict (id) do nothing;

-- A file is readable when its documents row is visible (group documents, or your own private ones).
create policy "documents: visible files read" on storage.objects for select
  using (bucket_id = 'documents'
    and exists (select 1 from public.documents d where d.storage_path = name));

create policy "documents: owner uploads" on storage.objects for insert
  with check (bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_trip_member(((storage.foldername(name))[2])::uuid, true));

create policy "documents: owner deletes" on storage.objects for delete
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
