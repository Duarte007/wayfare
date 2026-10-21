-- Hardening from the Supabase advisors (security + performance), applied while tables are empty.

-- Fixed search_path on the sync trigger function.
alter function public.touch_sync_columns() set search_path = '';

-- Trigger functions are not meant to be called through the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.add_trip_owner() from public, anon, authenticated;

-- Membership checks run inside RLS policies for signed-in users only.
revoke execute on function public.is_trip_member(uuid, boolean) from public, anon;
grant execute on function public.is_trip_member(uuid, boolean) to authenticated;

-- Policies apply to signed-in users only, and evaluate auth.uid() once per query, not per row.
alter policy "own profile: read" on public.profiles to authenticated
  using (id = (select auth.uid()));
alter policy "own profile: update" on public.profiles to authenticated
  using (id = (select auth.uid()));
alter policy "profiles: trip mates read" on public.profiles to authenticated using (
  exists (
    select 1 from public.trip_members a
    join public.trip_members b on a.trip_id = b.trip_id
    where a.user_id = (select auth.uid()) and b.user_id = profiles.id
  )
);

alter policy "trips: members read" on public.trips to authenticated using (public.is_trip_member(id));
alter policy "trips: owner creates" on public.trips to authenticated
  with check (owner_id = (select auth.uid()));
alter policy "trips: editors update" on public.trips to authenticated
  using (public.is_trip_member(id, true));
alter policy "trips: owner deletes" on public.trips to authenticated
  using (owner_id = (select auth.uid()));

alter policy "members: members read" on public.trip_members to authenticated
  using (public.is_trip_member(trip_id));
alter policy "members: owner manages" on public.trip_members to authenticated using (
  exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = (select auth.uid()))
  or user_id = (select auth.uid())
);

alter policy "ai usage: own read" on public.ai_usage to authenticated
  using (user_id = (select auth.uid()));

alter policy "invites: editors read" on public.trip_invites to authenticated
  using (public.is_trip_member(trip_id, true));
alter policy "invites: editors revoke" on public.trip_invites to authenticated
  using (public.is_trip_member(trip_id, true));

do $$
declare
  t text;
  shared_tables text[] := array['stops', 'stays', 'legs', 'activities', 'documents', 'checklist_items'];
  visible text;
begin
  foreach t in array array['places', 'stops', 'stays', 'legs', 'activities', 'documents',
    'document_links', 'checklist_items', 'ai_content']
  loop
    visible := case when t = any (shared_tables)
      then ' and (visibility = ''group'' or created_by = (select auth.uid()))' else '' end;
    execute format('alter policy "members read" on public.%I to authenticated
      using (public.is_trip_member(trip_id)%s)', t, visible);
    execute format('alter policy "editors insert" on public.%I to authenticated
      with check (public.is_trip_member(trip_id, true))', t);
    execute format('alter policy "editors update" on public.%I to authenticated
      using (public.is_trip_member(trip_id, true)%s)', t, visible);
    execute format('alter policy "editors delete" on public.%I to authenticated
      using (public.is_trip_member(trip_id, true)%s)', t, visible);
  end loop;
end;
$$;

alter policy "documents: visible files read" on storage.objects to authenticated
  using (bucket_id = 'documents' and exists (select 1 from public.documents d where d.storage_path = name));
alter policy "documents: owner uploads" on storage.objects to authenticated
  with check (bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.is_trip_member(((storage.foldername(name))[2])::uuid, true));
alter policy "documents: owner deletes" on storage.objects to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Indexes on foreign keys (cascades and joins).
create index activities_stop_id_idx on public.activities (stop_id);
create index activities_place_id_idx on public.activities (place_id);
create index activities_created_by_idx on public.activities (created_by);
create index checklist_items_created_by_idx on public.checklist_items (created_by);
create index documents_owner_id_idx on public.documents (owner_id);
create index documents_created_by_idx on public.documents (created_by);
create index legs_from_stop_id_idx on public.legs (from_stop_id);
create index legs_to_stop_id_idx on public.legs (to_stop_id);
create index legs_from_place_id_idx on public.legs (from_place_id);
create index legs_to_place_id_idx on public.legs (to_place_id);
create index legs_created_by_idx on public.legs (created_by);
create index stays_stop_id_idx on public.stays (stop_id);
create index stays_place_id_idx on public.stays (place_id);
create index stays_created_by_idx on public.stays (created_by);
create index stops_place_id_idx on public.stops (place_id);
create index stops_created_by_idx on public.stops (created_by);
create index trip_invites_trip_id_idx on public.trip_invites (trip_id);
create index trip_invites_created_by_idx on public.trip_invites (created_by);
create index trip_members_user_id_idx on public.trip_members (user_id);
create index trips_owner_id_idx on public.trips (owner_id);
