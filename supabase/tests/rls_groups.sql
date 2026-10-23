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

-- Only the owner deletes (soft-deletes) or restores the trip; nobody changes its owner.
create function pg_temp.sqlstate_of(statement text) returns text language plpgsql as $$
begin
  execute statement;
  return '00000';
exception when others then
  return sqlstate;
end;
$$;

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select pg_temp.check(
  pg_temp.sqlstate_of($q$update public.trips set name = 'Lisbon, Porto & Sintra', deleted_at = null
    where id = '10000000-0000-0000-0000-000000000001'$q$) = '00000',
  'an editor can still edit the trip');
select pg_temp.check(
  pg_temp.sqlstate_of($q$update public.trips set deleted_at = now()
    where id = '10000000-0000-0000-0000-000000000001'$q$) = '42501',
  'an editor cannot soft-delete the trip (insufficient_privilege)');
select pg_temp.check(
  pg_temp.sqlstate_of($q$update public.trips set owner_id = '00000000-0000-0000-0000-00000000000b'
    where id = '10000000-0000-0000-0000-000000000001'$q$) = '42501',
  'an editor cannot take over the trip');
select pg_temp.check(
  (select deleted_at is null and owner_id = '00000000-0000-0000-0000-00000000000a'
     from public.trips where id = '10000000-0000-0000-0000-000000000001'),
  'the trip is untouched after the refused changes');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select pg_temp.check(
  pg_temp.sqlstate_of($q$update public.trips set deleted_at = now()
    where id = '10000000-0000-0000-0000-000000000001'$q$) = '00000',
  'the owner can soft-delete the trip');
select pg_temp.check(
  (select deleted_at is not null from public.trips where id = '10000000-0000-0000-0000-000000000001'),
  'the trip is marked deleted');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select pg_temp.check(
  pg_temp.sqlstate_of($q$update public.trips set deleted_at = null
    where id = '10000000-0000-0000-0000-000000000001'$q$) = '42501',
  'an editor cannot restore a deleted trip');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select pg_temp.check(
  pg_temp.sqlstate_of($q$update public.trips set deleted_at = null
    where id = '10000000-0000-0000-0000-000000000001'$q$) = '00000',
  'the owner can restore the trip');
select pg_temp.check(
  pg_temp.sqlstate_of($q$update public.trips set owner_id = '00000000-0000-0000-0000-00000000000b'
    where id = '10000000-0000-0000-0000-000000000001'$q$) = '42501',
  'not even the owner changes owner_id');


-- Documents: a row can't be used to reach someone else's file.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select pg_temp.check(
  pg_temp.sqlstate_of($q$insert into public.documents (id, trip_id, owner_id, title, label, mime, size_bytes, storage_path)
    values ('50000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001',
            '00000000-0000-0000-0000-00000000000a', 'Visa Ana', 'visa', 'application/pdf', 1000,
            '00000000-0000-0000-0000-00000000000a/10000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000003')$q$) = '00000',
  'the owner adds a document with its own file path');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select pg_temp.check(
  pg_temp.sqlstate_of($q$insert into public.documents (id, trip_id, owner_id, title, label, mime, size_bytes, visibility)
    values ('50000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001',
            '00000000-0000-0000-0000-00000000000a', 'Fake', 'other', 'application/pdf', 1000, 'group')$q$) = '42501',
  'a member cannot add a document in someone else''s name');
select pg_temp.check(
  pg_temp.sqlstate_of($q$insert into public.documents (id, trip_id, owner_id, title, label, mime, size_bytes, visibility, storage_path)
    values ('50000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001',
            '00000000-0000-0000-0000-00000000000b', 'Peek', 'other', 'application/pdf', 1000, 'group',
            '00000000-0000-0000-0000-00000000000a/10000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000003')$q$) = '42501',
  'a member cannot point a document at someone else''s file');
select pg_temp.check(
  pg_temp.sqlstate_of($q$update public.documents
    set storage_path = '00000000-0000-0000-0000-00000000000a/10000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000003'
    where id = '50000000-0000-0000-0000-000000000002'$q$) = '42501',
  'a member cannot swap the file of a shared document');
select pg_temp.check(
  pg_temp.sqlstate_of($q$update public.documents set title = 'Train G1234 (seat 5A)'
    where id = '50000000-0000-0000-0000-000000000002'$q$) = '00000',
  'a member can still edit a shared document''s details');


-- Group management, as the app's members card and invite page use it.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
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

-- Delete my account: Eva owns a trip and is a member of Dani's.
reset role;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000d', 'dani@example.com'),
  ('00000000-0000-0000-0000-00000000000e', 'eva@example.com');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000d');
insert into public.trips (id, name, start_date, end_date)
  values ('10000000-0000-0000-0000-00000000000d', 'Dani trip', '2027-01-01', '2027-01-10');
insert into public.places (id, trip_id, name, lat, lng, country_code)
  values ('20000000-0000-0000-0000-00000000000d', '10000000-0000-0000-0000-00000000000d', 'Rome', 41.9, 12.5, 'IT');
insert into public.stops (id, trip_id, place_id, start_date, end_date, position)
  values ('30000000-0000-0000-0000-00000000000d', '10000000-0000-0000-0000-00000000000d',
          '20000000-0000-0000-0000-00000000000d', '2027-01-01', '2027-01-05', 0);
create temp table dani_invite as select public.create_trip_invite('10000000-0000-0000-0000-00000000000d') as token;
grant select on dani_invite to authenticated;

select pg_temp.act_as('00000000-0000-0000-0000-00000000000e');
select public.accept_trip_invite((select token from dani_invite));
insert into public.activities (id, trip_id, stop_id, title, assignees)
  values ('40000000-0000-0000-0000-0000000000e1', '10000000-0000-0000-0000-00000000000d',
          '30000000-0000-0000-0000-00000000000d', 'Colosseum',
          array['00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000e']::uuid[]);
insert into public.activities (id, trip_id, stop_id, title, visibility)
  values ('40000000-0000-0000-0000-0000000000e2', '10000000-0000-0000-0000-00000000000d',
          '30000000-0000-0000-0000-00000000000d', 'Eva secret', 'private');
insert into public.trips (id, name, start_date, end_date)
  values ('10000000-0000-0000-0000-00000000000e', 'Eva trip', '2027-02-01', '2027-02-10');

select pg_temp.act_as('');
do $$
begin
  perform public.delete_my_account();
  raise exception 'FAILED: deleted an account without signing in';
exception when insufficient_privilege then
  raise notice 'ok - deleting an account needs a signed-in user';
end;
$$;

select pg_temp.act_as('00000000-0000-0000-0000-00000000000e');
select public.delete_my_account();

reset role;
select pg_temp.check(
  not exists (select 1 from auth.users where id = '00000000-0000-0000-0000-00000000000e'),
  'delete_my_account removes the caller');
select pg_temp.check(
  exists (select 1 from auth.users where id = '00000000-0000-0000-0000-00000000000d'),
  'delete_my_account leaves everyone else');
select pg_temp.check(
  not exists (select 1 from public.trips where id = '10000000-0000-0000-0000-00000000000e'),
  'trips the caller owned are deleted');
select pg_temp.check(
  exists (select 1 from public.trips where id = '10000000-0000-0000-0000-00000000000d'),
  'trips the caller joined stay');
select pg_temp.check(
  not exists (select 1 from public.activities where id = '40000000-0000-0000-0000-0000000000e2'),
  'the caller''s private items in other trips are deleted');
select pg_temp.check(
  (select created_by = '00000000-0000-0000-0000-00000000000d'
          and assignees = array['00000000-0000-0000-0000-00000000000d']::uuid[]
     from public.activities where id = '40000000-0000-0000-0000-0000000000e1'),
  'the caller''s shared items stay, handed to the trip owner, without the caller');
select pg_temp.check(
  not exists (select 1 from public.trip_members where user_id = '00000000-0000-0000-0000-00000000000e'),
  'the caller''s memberships are gone');

rollback;
