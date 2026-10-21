-- RLS checks for group trips. Runs with plain psql (no extensions needed):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_groups.sql
-- Each failed check raises an exception; everything runs in a rolled-back transaction.
begin;

grant usage on schema public, auth, extensions to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'bia@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'caio@example.com');

create function pg_temp.act_as(uid text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', uid, true), set_config('role', 'authenticated', true);
$$;

create function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FAILED: %', label; end if;
  raise notice 'ok - %', label;
end;
$$;

-- Ana creates a trip with a shared stop, a private activity and a private passport.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
insert into public.trips (id, name, start_date, end_date)
  values ('10000000-0000-0000-0000-000000000001', 'Lisbon & Porto', '2026-10-23', '2026-11-19');
insert into public.places (id, trip_id, name, lat, lng, country_code)
  values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Lisbon', 38.72, -9.14, 'PT');
insert into public.stops (id, trip_id, place_id, start_date, end_date, position)
  values ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
          '20000000-0000-0000-0000-000000000001', '2026-10-23', '2026-10-28', 0);
insert into public.activities (id, trip_id, stop_id, title, visibility)
  values ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
          '30000000-0000-0000-0000-000000000001', 'Spa day', 'private');
insert into public.documents (id, trip_id, title, label, mime, size_bytes)
  values ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
          'Passport Ana', 'passport', 'image/jpeg', 1000);
insert into public.documents (id, trip_id, title, label, mime, size_bytes, visibility)
  values ('50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001',
          'Train G1234', 'train', 'application/pdf', 1000, 'group');

create temp table invite as select public.create_trip_invite('10000000-0000-0000-0000-000000000001') as token;
grant select on invite to authenticated;

-- Caio is not in the group: sees nothing.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select pg_temp.check((select count(*) from public.trips) = 0, 'outsider cannot see the trip');
select pg_temp.check((select count(*) from public.documents) = 0, 'outsider cannot see documents');

-- Bia joins with the invite link.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select pg_temp.check(
  public.accept_trip_invite((select token from invite)) = '10000000-0000-0000-0000-000000000001',
  'invite adds the member');
select pg_temp.check((select count(*) from public.trips) = 1, 'member sees the trip');
select pg_temp.check((select count(*) from public.stops) = 1, 'member sees the shared itinerary');
select pg_temp.check((select count(*) from public.activities) = 0, 'member cannot see a private activity');
select pg_temp.check(
  (select array_agg(title order by title) from public.documents) = array['Train G1234'],
  'member sees shared documents but not the passport');

-- Bia adds her own side trip, shared but assigned to her only.
insert into public.activities (id, trip_id, stop_id, title, assignees)
  values ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001',
          '30000000-0000-0000-0000-000000000001', 'Great Wall hike', array['00000000-0000-0000-0000-00000000000b']::uuid[]);
update public.activities set title = 'hacked' where id = '40000000-0000-0000-0000-000000000001';

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select pg_temp.check((select title from public.activities where id = '40000000-0000-0000-0000-000000000001') = 'Spa day',
  'a member cannot edit someone else''s private item');
select pg_temp.check((select count(*) from public.activities) = 2, 'owner sees her private item and the shared one');
select pg_temp.check(
  (select count(*) from public.profiles where id = '00000000-0000-0000-0000-00000000000b') = 1,
  'trip mates can see each other''s profile');

-- Group management, as the app's members card and invite page use it.
create temp table viewer_invite as
  select public.create_trip_invite('10000000-0000-0000-0000-000000000001', 'viewer') as token;
grant select on viewer_invite to authenticated;

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select public.accept_trip_invite((select token from viewer_invite));
select pg_temp.check(
  (select role from public.trip_members where user_id = '00000000-0000-0000-0000-00000000000c') = 'viewer',
  'an invite grants its role');
do $$
begin
  perform public.create_trip_invite('10000000-0000-0000-0000-000000000001');
  raise exception 'FAILED: a viewer created an invite';
exception when insufficient_privilege then
  raise notice 'ok - viewers cannot invite';
end;
$$;
do $$
begin
  perform public.accept_trip_invite('not-a-real-token-0000000');
  raise exception 'FAILED: an unknown token was accepted';
exception when no_data_found then
  raise notice 'ok - unknown or expired tokens are refused (P0002)';
end;
$$;

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
delete from public.trip_members where user_id = '00000000-0000-0000-0000-00000000000c';
select pg_temp.check(
  (select count(*) from public.trip_members where trip_id = '10000000-0000-0000-0000-000000000001') = 3,
  'a member cannot remove someone else');
delete from public.trip_members
  where trip_id = '10000000-0000-0000-0000-000000000001' and user_id = '00000000-0000-0000-0000-00000000000b';
select pg_temp.check((select count(*) from public.trips) = 0, 'a member can leave, and then sees nothing');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
delete from public.trip_members where user_id = '00000000-0000-0000-0000-00000000000c';
select pg_temp.check(
  (select array_agg(user_id) from public.trip_members where trip_id = '10000000-0000-0000-0000-000000000001')
    = array['00000000-0000-0000-0000-00000000000a']::uuid[],
  'the owner removes members and stays');

rollback;
