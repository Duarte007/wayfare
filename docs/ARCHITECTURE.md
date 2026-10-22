# Architecture

Wayfare follows Clean Architecture with SOLID. Dependencies point inward only, and ESLint
(`no-restricted-imports` in `eslint.config.js`) fails the build when a layer imports an outer one.

```
UI / HTTP interface  →  Application (use cases, hooks)  →  Domain (types, pure rules)
            ↑                         ↑
      Infrastructure (Supabase, Dexie, Claude, Qwen) implements the application's ports
```

## Layers

| Layer          | Where                                                                   | May import                     | Never imports                          |
| -------------- | ----------------------------------------------------------------------- | ------------------------------ | -------------------------------------- |
| Domain         | `packages/shared`, `apps/web/src/features/*/domain`                     | Other domain code, `zod`       | React, SDKs, outer layers              |
| Application    | `apps/api/src/application`, `apps/web/src/features/*/application`       | Domain, ports                  | Infrastructure, SDKs, UI               |
| Infrastructure | `apps/api/src/infrastructure`, `apps/web/src/features/*/infrastructure` | Application ports, domain, SDK | UI, HTTP routes                        |
| Interface / UI | `apps/api/src/interface`, `apps/web/src/features/*/ui`                  | Application, domain            | Infrastructure (adapters are injected) |

Composition roots are the only places that pick concrete adapters:
`apps/api/src/container.ts` and `apps/web/src/app/dependencies.ts`.

## How SOLID shows up

- **Single responsibility:** a use case does one job (`GetCityTips`); controllers only validate and
  delegate; `useSignInFlow` holds the sign-in state machine while `SignInPage` only renders.
- **Open/closed:** a new AI provider is a new `TipsGenerator` added to `FallbackTipsGenerator`'s list;
  no existing class changes.
- **Liskov:** `ClaudeTipsGenerator`, `QwenTipsGenerator` and `FallbackTipsGenerator` are
  interchangeable wherever a `TipsGenerator` is expected.
- **Interface segregation:** small ports (`TipsCache`, `AiQuota`, `BuyLinkBuilder`, `TripRepository`).
- **Dependency inversion:** use cases and hooks receive ports through constructors or React context;
  tests pass in-memory fakes.

## Adding a feature

1. Domain: types and pure rules in `features/<name>/domain` (or `packages/shared` when the API needs them).
2. Application: a port interface plus a hook or use case that depends only on it.
3. Infrastructure: an adapter implementing the port (Dexie, Supabase, an external API).
4. UI or HTTP: render or route, calling the application layer.
5. Wire the adapter in the composition root. Unit-test the application layer with fakes.

## Conventions

- Names reveal intent; no abbreviations except well-known ones (`id`, `url`).
- Functions stay small; comments explain why, not what.
- Errors are typed in the application layer (`QuotaExceededError`) and mapped to HTTP in one place.
- Conventional Commits (`feat:`, `fix:`, `refactor:`...), small pull requests, squash merge.

## Maps

Offline maps use Protomaps vector tiles from a PMTiles archive we host. Tiles go through a
`wayfare-map://` protocol, so a downloaded city never touches the network. MapLibre is
lazy-loaded behind the `MapRenderer` port. Decision, trade-offs (China, GCJ-02) and owner
setup: see [`docs/MAPS.md`](MAPS.md).

## Bundle size

The first load is the app shell, sign-in and the trips list. Every other screen is a lazy route
(`lazyRouteComponent` in `app/router.tsx`), and heavy pieces load on demand: the date picker
(`LazyCalendar`), the language picker on sign-in, zod (with the first city search), MapLibre and
every locale but the active one (`loadMessages` in `@wayfare/i18n`). The service worker precaches
every chunk, so each screen and language still opens offline after the first visit. CI runs
`pnpm --filter @wayfare/web size` after the build: it fails when the first load (entry,
modulepreloads, CSS and one locale, gzipped) passes the budget in
`apps/web/scripts/check-bundle-size.mjs`. Keep new heavy code behind a dynamic import.
