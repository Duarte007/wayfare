-- Sync triggers, member policies and group visibility for trip-scoped tables.
--
-- A trip is a group: every member sees items with visibility 'group'. An item marked 'private' is
-- seen only by its creator (a personal day trip, a passport scan). `assignees` narrows a group item
-- to some members (empty = everyone), which drives the per-person itinerary views.

do $$
declare
  t text;
  shared_tables text[] := array['stops', 'stays', 'legs', 'activities', 'documents', 'checklist_items'];
  visible text;
begin
  -- Sync version + updated_at on every write, and an index for incremental pulls.
  foreach t in array array['trips', 'places', 'stops', 'stays', 'legs', 'activities', 'documents',
    'document_links', 'checklist_items', 'ai_content']
  loop
    execute format(
      'create trigger %1$s_sync before insert or update on public.%1$I
         for each row execute function public.touch_sync_columns()', t);
    execute format('create index %1$s_sync_idx on public.%1$I (%2$s, version)', t,
      case when t = 'trips' then 'id' else 'trip_id' end);
  end loop;

  -- Items that can be shared with the group or kept private.
  foreach t in array shared_tables
  loop
    execute format('alter table public.%I
      add column created_by uuid not null default auth.uid() references auth.users (id),
      add column visibility text not null default %L check (visibility in (''group'', ''private'')),
      add column assignees uuid[] not null default ''{}''', t,
      case when t = 'documents' then 'private' else 'group' end);
  end loop;

  -- Member policies; shared tables also hide other members' private items.
  foreach t in array array['places', 'stops', 'stays', 'legs', 'activities', 'documents',
    'document_links', 'checklist_items', 'ai_content']
  loop
    visible := case when t = any (shared_tables)
      then ' and (visibility = ''group'' or created_by = auth.uid())' else '' end;
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "members read" on public.%I for select
      using (public.is_trip_member(trip_id)%s)', t, visible);
    execute format('create policy "editors insert" on public.%I for insert
      with check (public.is_trip_member(trip_id, true))', t);
    execute format('create policy "editors update" on public.%I for update
      using (public.is_trip_member(trip_id, true)%s)', t, visible);
    execute format('create policy "editors delete" on public.%I for delete
      using (public.is_trip_member(trip_id, true)%s)', t, visible);
  end loop;
end;
$$;

create index documents_tags_idx on public.documents using gin (tags);

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
