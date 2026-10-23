-- "Delete my account" (roadmap item 15): a signed-in user removes their own account and data.
--
-- What happens to each kind of row:
--   * Trips they own are deleted for everyone, with everything in them (foreign keys cascade).
--     Trip mates' devices drop the trip on their next sync, as when someone leaves a trip.
--   * In other people's trips:
--       - their private items (visibility 'private') are deleted;
--       - their shared items stay, because the group planned around them, and are handed to the
--         trip owner (created_by); they are also taken off "who is going" (assignees);
--       - their documents are deleted with the account (documents.owner_id cascades), since the
--         files live in their own storage folder. The app removes those files first.
--   * Their invites, memberships, profile and AI usage are deleted.
--
-- The function runs as its owner to reach auth.users, and only ever acts on auth.uid().

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  t text;
begin
  if me is null then
    raise exception 'Sign in to delete your account' using errcode = '42501';
  end if;

  delete from public.trips where owner_id = me;

  foreach t in array array['stops', 'stays', 'legs', 'activities', 'documents', 'checklist_items']
  loop
    execute format('delete from public.%I where created_by = $1 and visibility = ''private''', t)
      using me;
    execute format(
      'update public.%1$I x set created_by = tr.owner_id, assignees = array_remove(x.assignees, $1)
         from public.trips tr
        where tr.id = x.trip_id and (x.created_by = $1 or $1 = any (x.assignees))', t)
      using me;
  end loop;

  delete from public.trip_invites where created_by = me;
  delete from auth.users where id = me;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
