-- Only the owner can delete a trip.
--
-- Trips are soft-deleted (deleted_at) through an UPDATE so the deletion syncs to every device, and
-- the "trips: editors update" policy lets editors update the row. This trigger closes that gap:
-- for a signed-in user, setting deleted_at (or clearing it, which would restore the trip) is
-- reserved for the owner, and owner_id never changes.
--
-- SQLSTATE 42501 (insufficient_privilege) is a permanent error for the client's sync, which sets
-- the change aside instead of retrying it forever.
--
-- Server-side code without a user (service role, SQL editor, migrations) has no auth.uid() and is
-- not restricted; RLS already keeps anonymous requests away from trips.

create or replace function public.guard_trip_ownership()
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

  if new.owner_id is distinct from old.owner_id then
    raise exception 'A trip''s owner cannot be changed'
      using errcode = '42501', hint = 'owner_id is set when the trip is created.';
  end if;

  if (old.deleted_at is null) <> (new.deleted_at is null) and uid <> old.owner_id then
    raise exception 'Only the trip owner can delete or restore the trip'
      using errcode = '42501', hint = 'Ask the trip owner to delete it, or leave the trip.';
  end if;

  return new;
end;
$$;

-- Trigger functions are not meant to be called through the API.
revoke execute on function public.guard_trip_ownership() from public, anon, authenticated;

create trigger trips_guard_ownership
  before update on public.trips
  for each row execute function public.guard_trip_ownership();
