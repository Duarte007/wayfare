# Wayfare

Offline-first travel app: itinerary with a city calendar, offline maps and documents, group trips,
and AI tips per city. Built for any destination, including places with restricted or no
connectivity. Planned in
[the product and technical plan](https://claude.ai/artifact/TiniG51XcUrrkQ5zL2okut).

## Stack

| Part      | Tech                                                                        |
| --------- | --------------------------------------------------------------------------- |
| Web (PWA) | React 19, Vite, TanStack Router, Tailwind CSS 4, Dexie (IndexedDB), i18next |
| API       | Hono on Vercel Functions (Node 22)                                          |
| Data      | Supabase: Postgres with Row Level Security, Auth, Storage                   |
| AI        | Claude (primary), Qwen (fallback), called only from the API                 |
| Languages | English, Português (Brasil), 简体中文, Español, 日本語                      |

## Layout

```
apps/web         PWA (features/<name>/{domain,application,infrastructure,ui})
apps/api         API (application, infrastructure, interface/http, container.ts)
packages/shared  Domain types and pure rules shared by web and API
packages/i18n    Translations for the five languages
supabase         Migrations, RLS tests, local config
docs             Architecture notes
```

Architecture rules: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Getting started

```bash
nvm use            # Node 22
corepack enable    # pnpm
pnpm install
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env
pnpm dev           # web on :5173, API on :8787
```

Local database: `supabase start` (Supabase CLI), then `supabase db reset` applies `supabase/migrations`.

## Checks

```bash
pnpm lint                              # includes layer-boundary rules
pnpm turbo run build typecheck test
```

CI also applies the migrations to Postgres 17 and runs `supabase/tests/rls_groups.sql`.

## Sign-in

Supabase Auth handles every method: email + password and a 6-digit email code (work on any
network), Apple and Google (Google is unreachable on some restricted networks, so users are told
to sign in before they travel).

## Group trips

A trip is a group. Members join by invite link (`create_trip_invite` / `accept_trip_invite`).
Items with `visibility = 'group'` are shared; `private` items are seen only by their creator, and
`assignees` narrows a shared item to some members, which powers the per-person itinerary view.
Documents are private by default; tickets can be shared with the group.

## Deploy

Two Vercel projects from this repo: `apps/web` (app.&lt;domain&gt;) and `apps/api` (api.&lt;domain&gt;).
Cloudflare DNS records point to Vercel with the proxy off (DNS only). Supabase uses a custom
domain (auth.&lt;domain&gt;) so the browser never calls `*.supabase.co`.
