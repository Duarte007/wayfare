# Wayfare roadmap

A working TODO list. Each item is self-contained so it can be handed to `/goal` as one objective:
it says what to build, what "done" means, and what it depends on. Work top to bottom. Every item
ships as its own PR and follows `CLAUDE.md` (i18n in 5 locales, offline-first, layers, tests).

Status: `[ ]` to do · `[~]` in progress · `[x]` done (link the PR).

## Done so far

- [x] Monorepo, Clean Architecture, CI, Vercel (web + API in sin1), Supabase with RLS — #1
- [x] Email/password sign-in, reset, magic code; destination-agnostic, family-friendly UI — #1
- [x] AI tips API (Claude → Qwen fallback, quota, cache) with trip-access check — #3
- [x] App shell (sidebar / tab bar), profile (name, language, theme, sign out) — #5
- [x] Create trip — #6 · Offline-first sync with the server — #7 · shadcn/ui — #8
- [x] Trip page: summary, what's missing, itinerary timeline, edit, delete — #9
- [x] Click audit fixes; this roadmap — #10
- [x] Cities in the itinerary (search, add, nights, reorder, remove) — item 2

## Now — make the trip usable end to end

### 1. Click audit fixes ✅

- **Goal:** every button, link and control does something visible; nothing is a dead end.
- **Done when:** the Chromium click audit (all screens, phone + desktop) reports no `NO EFFECT`
  and no page errors.
- **Found in the first audit (fixed in the PR that adds this file):**
  - "Continue with Apple/Google" opened a raw Supabase error page (providers not enabled).
    Now the buttons only appear for providers switched on in Supabase (`/auth/v1/settings`).
  - The trip page was 427 px wide on a 390 px phone (long hotel names), so the browser zoomed
    out and the bottom tab bar kept moving. Stay rows now truncate and stack on phones.

### 2. Cities in the itinerary (add, edit, reorder, remove) ✅

- **Goal:** build the route from the trip page: "Add city" → search a place → pick nights.
- **Done when:** a city can be added with a place search (name, local name, country, lat/lng),
  its dates follow from nights (chained like the reference artifact), cities can be reordered
  and removed, and everything works offline and syncs (places + stops).
- **Shipped:** `GET /geo/search` on our API (signed-in only) proxies OpenStreetMap Nominatim
  with names in the user's language plus the local name, cached per instance; the app talks only
  to our API. Follow-ups: cache recent results on the device; consider a second geocoder if
  Nominatim's fair-use limit is ever hit.

### 3. Stays (hotels) per city

- **Goal:** add/edit/remove where you sleep in each city.
- **Done when:** stays have name, check-in/out (inside the city's dates), booking ref/URL and
  notes; "what's missing" updates live; private vs. group visibility can be chosen.

### 4. Transport between cities (legs)

- **Goal:** say how you get from one city to the next.
- **Done when:** a leg can be added from the "Transport not set" chip with mode, carrier,
  number, departure/arrival with time zones and booking ref; shown on the timeline.

### 5. Activities per city

- **Goal:** plan things to do (tickets, tours) per city and day.
- **Done when:** activities with title, date, needs-booking/booked and URL can be added, ticked
  off and assigned to some members; counts show on the timeline.

### 6. Documents (upload, offline, search, auto label)

- **Goal:** keep passports, tickets and vouchers available offline.
- **Done when:** files upload to the private `documents` bucket, are cached on the device for
  offline viewing, get a suggested label and title (`@wayfare/shared/labels`), can be searched
  and filtered by label, linked to a stay/leg/activity (pushes `document_links`), and are
  private by default with an option to share with the group.

### 7. Group trips (invites, members, my itinerary)

- **Goal:** plan together and still see your own plan.
- **Done when:** the owner creates an invite link (`create_trip_invite`), a friend opens it,
  signs in and joins (`accept_trip_invite`); members are listed with roles; the owner can
  remove members and members can leave; a "Mine / Everyone" switch filters items by
  `assignees`; private items stay private.

### 8. Calendar view

- **Goal:** the reference artifact's month calendar with each city's days coloured.
- **Done when:** a calendar tab shows the trip days coloured by city (stop `color_index`),
  stays and legs marked, and tapping a day shows that day's plan.

### 9. Checklist

- **Goal:** a to-do list per trip (visa, insurance, SIM, money…).
- **Done when:** `checklist_items` can be added, ticked, assigned and synced; a starter list
  comes from data templates per destination country (not hard-coded in the UI).

### 10. AI tips in the app

- **Goal:** per-city suggestions (events, tours, food, shopping) from the existing API.
- **Done when:** a city shows a "Tips" panel that calls `/ai/city-tips`, shows cached results
  offline, the daily quota, friendly errors (429/503), and lets you add a tip as an activity.
- **Blocked by:** Anthropic credits and a `QWEN_API_KEY` on `wayfare-api` (owner action).

### 11. City summaries

- **Goal:** the reference artifact's short summary per city (what to know, getting around,
  money, phrases), cached in `ai_content` and readable offline.

### 12. Offline maps

- **Goal:** see cities, stays and activities on a map without network, also in China.
- **Done when:** a map tab (MapLibre) shows the trip's places; the user can download the area
  of each city for offline use; tiles come from a source reachable in China (self-hosted
  PMTiles on Vercel/R2 or a China-friendly provider) and are stored on the device.

## Next — accounts, security and polish

### 13. Google and Apple sign-in working in production

- **Owner action:** enable the providers in Supabase (Google OAuth client; Apple Services ID,
  key and team), set Site URL and redirect URLs (`/` and `/reset`) for the production domain.
- **Done when:** both buttons sign in on the live site and land on the trips page.

### 14. Server rule: only the owner can delete a trip

- **Done when:** a trigger rejects setting `trips.deleted_at` by anyone but the owner, with an
  RLS test in `supabase/tests`.

### 15. Account deletion and data export

- **Done when:** the profile offers "Delete my account" (server function removes the user and
  their own data) and "Download my data"; required by the App Store and GDPR/LGPD.

### 16. App updates and install

- **Done when:** a toast says "New version available — reload" when the service worker has an
  update; an "Install app" hint shows on supported browsers; icons and splash for iOS/Android.

### 17. Performance

- **Done when:** routes are code-split (date picker, maps and documents load on demand) and the
  first load stays under ~200 KB gzipped.

### 18. Not-found page and error boundary

- **Done when:** unknown URLs show a friendly 404 with a way back, and a crash in one screen
  shows a recoverable error instead of a blank page.

### 19. Sync hardening

- **Done when:** a periodic full refresh catches rows a version cursor could miss; sync errors
  that were set aside are visible (and retryable) from the profile.

### 20. Automated end-to-end tests in CI

- **Done when:** the Playwright flows used in QA (sign-in, create trip, trip page, sync, click
  audit, axe) run in GitHub Actions against a preview build on every PR.

### 21. Custom domain

- **Owner action:** buy the domain on Cloudflare, point it at Vercel (web) and an `api.`
  subdomain (API), then update `ALLOWED_ORIGINS` and Supabase redirect URLs.
