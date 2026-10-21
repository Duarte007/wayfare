-- Wayfare initial schema: trips, itinerary, documents, AI cache.
-- Every synced table has client-generated UUIDs plus version / updated_at / deleted_at for offline sync.

create extension if not exists pgcrypto with schema extensions;

-- Global, monotonic version used as the sync cursor (GET /sync/pull?cursor=).
create sequence public.sync_version;
grant usage on sequence public.sync_version to authenticated;

create or replace function public.touch_sync_columns()
returns trigger
language plpgsql
as $$
begin
  new.version := nextval('public.sync_version');
  new.updated_at := now();
  return new;
end;
$$;

-- Profiles ---------------------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  locale text not null default 'en' check (locale in ('en', 'pt-BR', 'zh-CN', 'es', 'ja')),
  home_currency char(3),
  interests text[] not null default '{}',
  ai_label_fallback boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "own profile: read" on public.profiles for select using (auth.uid() = id);
create policy "own profile: update" on public.profiles for update using (auth.uid() = id);

-- Creates the profile row for every new user, whatever the sign-in method.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Trips and membership ---------------------------------------------------------------------------

create table public.trips (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  start_date date not null,
  end_date date not null,
  version bigint not null default 0,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (start_date <= end_date)
);

create table public.trip_members (
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  primary key (trip_id, user_id)
);

-- The owner is always a member.
create or replace function public.add_trip_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.trip_members (trip_id, user_id, role) values (new.id, new.owner_id, 'owner')
  on conflict do nothing;
  return new;
end;
$$;

create trigger trips_add_owner after insert on public.trips
  for each row execute function public.add_trip_owner();

create or replace function public.is_trip_member(p_trip_id uuid, p_write boolean default false)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.trip_members m
    where m.trip_id = p_trip_id
      and m.user_id = auth.uid()
      and (not p_write or m.role in ('owner', 'editor'))
  );
$$;

alter table public.trips enable row level security;
alter table public.trip_members enable row level security;

create policy "trips: members read" on public.trips for select using (public.is_trip_member(id));
create policy "trips: owner creates" on public.trips for insert with check (owner_id = auth.uid());
create policy "trips: editors update" on public.trips for update using (public.is_trip_member(id, true));
create policy "trips: owner deletes" on public.trips for delete using (owner_id = auth.uid());

create policy "members: members read" on public.trip_members for select
  using (public.is_trip_member(trip_id));

-- Itinerary --------------------------------------------------------------------------------------

create table public.places (
  id uuid primary key,
  trip_id uuid not null references public.trips (id) on delete cascade,
  name text not null,
  name_local text,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  country_code char(2) not null,
  city text,
  address text,
  address_local text,
  source text,
  external_id text,
  version bigint not null default 0,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.stops (
  id uuid primary key,
  trip_id uuid not null references public.trips (id) on delete cascade,
  place_id uuid not null references public.places (id),
  start_date date not null,
  end_date date not null,
  position int not null check (position >= 0),
  color_index int not null default 0 check (color_index between 0 and 7),
  version bigint not null default 0,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (start_date <= end_date)
);

create table public.stays (
  id uuid primary key,
  trip_id uuid not null references public.trips (id) on delete cascade,
  stop_id uuid not null references public.stops (id) on delete cascade,
  place_id uuid references public.places (id),
  name text not null,
  check_in date not null,
  check_out date not null,
  booking_ref text,
  booking_url text,
  notes text,
  version bigint not null default 0,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (check_in <= check_out)
);

create table public.legs (
  id uuid primary key,
  trip_id uuid not null references public.trips (id) on delete cascade,
  from_stop_id uuid not null references public.stops (id) on delete cascade,
  to_stop_id uuid not null references public.stops (id) on delete cascade,
  mode text not null check (mode in ('flight', 'train', 'bus', 'ferry', 'car', 'other')),
  carrier text,
  number text,
  depart_at timestamptz,
  depart_tz text,
  arrive_at timestamptz,
  arrive_tz text,
  from_place_id uuid references public.places (id),
  to_place_id uuid references public.places (id),
  booking_ref text,
  seat text,
  notes text,
  version bigint not null default 0,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.activities (
  id uuid primary key,
  trip_id uuid not null references public.trips (id) on delete cascade,
  stop_id uuid not null references public.stops (id) on delete cascade,
  place_id uuid references public.places (id),
  title text not null,
  date date,
  start_time time,
  needs_booking boolean not null default false,
  booked boolean not null default false,
  url text,
  source text not null default 'user' check (source in ('user', 'ai')),
  notes text,
  version bigint not null default 0,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Documents --------------------------------------------------------------------------------------

create table public.documents (
  id uuid primary key,
  trip_id uuid not null references public.trips (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  label text not null check (label in ('passport', 'visa', 'flight', 'train', 'bus_ferry', 'stay',
    'insurance', 'activity', 'health', 'money', 'other')),
  tags text[] not null default '{}',
  mime text not null,
  size_bytes int not null check (size_bytes between 1 and 20971520),
  sha256 text,
  storage_path text,
  page_count int,
  extracted_text text,
  label_confidence real,
  label_source text check (label_source in ('rules', 'user', 'ai')),
  version bigint not null default 0,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.document_links (
  document_id uuid not null references public.documents (id) on delete cascade,
  entity_type text not null check (entity_type in ('stop', 'stay', 'leg', 'activity')),
  entity_id uuid not null,
  trip_id uuid not null references public.trips (id) on delete cascade,
  version bigint not null default 0,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (document_id, entity_type, entity_id)
);

create table public.checklist_items (
  id uuid primary key,
  trip_id uuid not null references public.trips (id) on delete cascade,
  group_key text not null,
  title text not null,
  done boolean not null default false,
  due_date date,
  template_key text,
  position int not null default 0,
  version bigint not null default 0,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- AI ---------------------------------------------------------------------------------------------

create table public.ai_content (
  id uuid primary key,
  trip_id uuid not null references public.trips (id) on delete cascade,
  stop_id uuid references public.stops (id) on delete cascade,
  kind text not null check (kind in ('summary', 'tips')),
  locale text not null,
  input_hash text not null,
  payload jsonb not null,
  model text not null,
  edited boolean not null default false,
  generated_at timestamptz not null default now(),
  version bigint not null default 0,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index ai_content_lookup on public.ai_content (stop_id, input_hash);

create table public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default current_date,
  count int not null default 0,
  primary key (user_id, day)
);

alter table public.ai_usage enable row level security;
create policy "ai usage: own read" on public.ai_usage for select using (user_id = auth.uid());

-- Atomically counts one generation; returns false once the daily limit is reached.
create or replace function public.consume_ai_quota(daily_limit int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  used int;
begin
  insert into public.ai_usage (user_id, day, count) values (auth.uid(), current_date, 1)
  on conflict (user_id, day) do update set count = public.ai_usage.count + 1
  returning count into used;
  if used > daily_limit then
    update public.ai_usage set count = count - 1 where user_id = auth.uid() and day = current_date;
    return false;
  end if;
  return true;
end;
$$;

revoke execute on function public.consume_ai_quota(int) from anon;

-- Sync triggers, indexes and member policies for every trip-scoped table --------------------------

do $$
declare
  t text;
begin
  foreach t in array array['trips', 'places', 'stops', 'stays', 'legs', 'activities', 'documents',
    'document_links', 'checklist_items', 'ai_content']
  loop
    execute format(
      'create trigger %1$s_sync before insert or update on public.%1$I
         for each row execute function public.touch_sync_columns()', t);
    execute format('create index %1$s_sync_idx on public.%1$I (%2$s, version)', t,
      case when t = 'trips' then 'id' else 'trip_id' end);
  end loop;

  foreach t in array array['places', 'stops', 'stays', 'legs', 'activities', 'documents',
    'document_links', 'checklist_items', 'ai_content']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "members read" on public.%I for select using (public.is_trip_member(trip_id))', t);
    execute format('create policy "editors insert" on public.%I for insert with check (public.is_trip_member(trip_id, true))', t);
    execute format('create policy "editors update" on public.%I for update using (public.is_trip_member(trip_id, true))', t);
    execute format('create policy "editors delete" on public.%I for delete using (public.is_trip_member(trip_id, true))', t);
  end loop;
end;
$$;

create index documents_tags_idx on public.documents using gin (tags);

-- Groups: shared and personal items ---------------------------------------------------------------
-- A trip is a group: every member sees items with visibility 'group'. An item marked 'private' is
-- seen only by its creator (a personal day trip, a passport scan). `assignees` narrows a group item
-- to some members (empty = everyone), which drives the "Mine" and per-person itinerary views.

do $$
declare
  t text;
begin
  foreach t in array array['stops', 'stays', 'legs', 'activities', 'documents', 'checklist_items']
  loop
    execute format('alter table public.%I
      add column created_by uuid not null default auth.uid() references auth.users (id),
      add column visibility text not null default %L check (visibility in (''group'', ''private'')),
      add column assignees uuid[] not null default ''{}''', t,
      case when t = 'documents' then 'private' else 'group' end);
    execute format('drop policy "members read" on public.%I', t);
    execute format('drop policy "editors update" on public.%I', t);
    execute format('drop policy "editors delete" on public.%I', t);
    execute format('create policy "members read" on public.%I for select using (
      public.is_trip_member(trip_id) and (visibility = ''group'' or created_by = auth.uid()))', t);
    execute format('create policy "editors update" on public.%I for update using (
      public.is_trip_member(trip_id, true) and (visibility = ''group'' or created_by = auth.uid()))', t);
    execute format('create policy "editors delete" on public.%I for delete using (
      public.is_trip_member(trip_id, true) and (visibility = ''group'' or created_by = auth.uid()))', t);
  end loop;
end;
$$;

-- Members can see each other's names inside a shared trip.
create policy "profiles: trip mates read" on public.profiles for select using (
  exists (
    select 1 from public.trip_members a
    join public.trip_members b on a.trip_id = b.trip_id
    where a.user_id = auth.uid() and b.user_id = profiles.id
  )
);

create policy "members: owner manages" on public.trip_members for delete using (
  exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid())
  or user_id = auth.uid()  -- anyone can leave
);

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

revoke execute on function public.create_trip_invite(uuid, text) from anon;
revoke execute on function public.accept_trip_invite(text) from anon;

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
