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

revoke execute on function public.consume_ai_quota(int) from public, anon;
grant execute on function public.consume_ai_quota(int) to authenticated;
