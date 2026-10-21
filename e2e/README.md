# End-to-end tests

Playwright runs the real web app (a `vite build` + `vite preview` of `apps/web`) in Chromium and
drives it the way a person would: sign in, plan a trip, go offline, come back. The suite runs on
every pull request (the `e2e` job in `.github/workflows/ci.yml`) and never touches production.

```sh
pnpm test:e2e                          # from the repo root: builds the app, starts both servers, runs
pnpm --filter @wayfare/e2e exec playwright test tests/sync.spec.ts --project=phone-pt-BR
pnpm --filter @wayfare/e2e exec playwright show-report    # after a CI failure, from the artifact
```

The first time on a machine: `pnpm --filter @wayfare/e2e exec playwright install chromium`. To use
a Chromium that is already installed instead, set `E2E_CHROMIUM_PATH=/path/to/chrome`.

Locally, Playwright reuses servers that are already listening on ports 5188 (app) and 54329 (fake
backend). Stop them after changing app code, or the run tests the old build.

## The fake backend

`fake-backend/server.ts` is a small Node HTTP server, kept in memory, that answers the calls the
app makes. The app is built with `VITE_SUPABASE_URL` and `VITE_API_URL` pointing at it, so
supabase-js and our API client talk to it exactly as they would to the real services. It
implements only what the app uses:

| Real service     | Fake                                                                                    |
| ---------------- | --------------------------------------------------------------------------------------- |
| Supabase Auth    | password sign-in, refresh, `GET`/`PUT /user`, logout, `/settings` (no social providers) |
| PostgREST        | `select` with `eq`/`neq`/`gt(e)`/`lt(e)`/`in`/`is`, `order`, `limit`; insert; update    |
| Supabase Storage | upload (multipart), download, remove                                                    |
| Our API          | `/geo/search` over a fixed list of cities in several countries                          |

Like the database, it fills `version`, `updated_at`, `owner_id`/`created_by` and column defaults,
and it validates every row with the zod schemas from `@wayfare/shared`; a row the real database
would refuse gets a `23514` error, so the app marks the change rejected and the test fails.

Each test creates its own user, and each user only ever sees their own rows (a stand-in for RLS),
so tests run in parallel without sharing state. Tests talk to the fake through `/__admin/*`
(`support/backend.ts`): create a user, seed rows, read what the server received.

Why a server and not `page.route`: the app's requests go out exactly as in production (real
`fetch`, CORS, every browser context and page), `context.setOffline()` makes the server truly
unreachable, the state is shared by the tests' second "devices", and it can be started on its own
(`pnpm --filter @wayfare/e2e fake-backend`) to click around a build by hand.

The fake is not a test of the database: row-level security and triggers are covered by
`supabase/tests/rls_groups.sql` in the `database` job.

## What is covered

| Spec                     | Project(s)      | What                                                                                                                                                                                      |
| ------------------------ | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth.spec.ts`           | phone           | wrong password refused; sign-in opens the trips list                                                                                                                                      |
| `trip-flow.spec.ts`      | phone           | new trip (range picker), two cities via search, nights stepper, stay, train with times and time zones, activity + booked; "O que falta" follows; rows reach the server                    |
| `sync.spec.ts`           | phone           | offline edits wait in the outbox, reach the server when back online, and show on a second device                                                                                          |
| `sync-hardening.spec.ts` | phone           | "Atualizar tudo" removes a row the server dropped without a tombstone; sync times; a refused change is listed under sync issues, retry keeps it, discard removes it and the device's copy |
| `documents.spec.ts`      | phone           | a PDF saved on the device is uploaded to storage                                                                                                                                          |
| `screens.spec.ts`        | phone + desktop | trips list, trip page, profile: axe + click audit; new trip, calendar, checklist, documents: open + axe; 404 page with a way back                                                         |

Projects: `phone-pt-BR` (390×844, touch, pt-BR) runs everything; `desktop-en` (1280×900, English)
runs `screens.spec.ts`. The flow specs read pt-BR labels literally; the screen specs look labels
up in `@wayfare/i18n` (`support/i18n.ts`) so they work in both languages.

- **axe** (`expectAccessible`): the tags used in manual QA, `wcag2a`, `wcag2aa`, `wcag21aa`, must
  report zero violations.
- **Click audit** (`expectNoDeadClicks`): every visible button, link and control on the screen is
  clicked on a freshly loaded copy of it; the test fails listing any that changed nothing (no
  navigation, overlay, visible text, ARIA state, new tab, download or request to the server).
  Sign-out is skipped; destructive actions only open their confirmation, which counts.

## Writing tests

- Locate by role and label (`getByRole`, `getByLabel`), with `exact: true` where labels overlap
  ("Horário" and "Fuso horário").
- No fixed sleeps: wait with `expect(...)` and `expect.poll(...)`.
- Start signed in with `signInWithSession(context, user)` unless the test is about signing in, and
  seed what the screen needs with `backend.seed` (`support/seed.ts` has a planned trip).
- Every uncaught page error fails the test (`pageErrors` fixture).
