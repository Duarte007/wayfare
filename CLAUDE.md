# Wayfare: working agreements

## Workflow

- Every change goes through a pull request. Never push to `main` directly: create a branch
  (`feat/…`, `fix/…`, `chore/…`), push it, and open a PR against `main`.
- After a PR is merged into `main`, delete its remote feature branch (`feat/…`, `fix/…`,
  `chore/…`). Keep "Automatically delete head branches" on in the GitHub repository settings.
- Conventional Commits for commit messages and PR titles.
- Before opening a PR: `pnpm format:check`, `pnpm lint`, `pnpm turbo run build typecheck test`.
- Database changes: add a migration in `supabase/migrations`, run `supabase/tests/rls_groups.sql`
  against it, and never use `drop` in migrations applied through the Supabase MCP (they wait for a
  confirmation that times out).

## Product

- The app is destination-agnostic. Never hard-code a country (copy, defaults, examples).
  Country-specific behaviour belongs in data (checklist templates, buy-link providers, keywords).
- Offline-first: every read comes from the local store; the network only syncs.
- Every user-facing string goes through i18n in all five locales (en, pt-BR, zh-CN, es, ja).

## Code

- Clean Architecture and SOLID; layer rules are enforced by ESLint. See `docs/ARCHITECTURE.md`.
- UI: lucide icons, design tokens from `apps/web/src/styles.css` (contrast is unit-tested),
  44px minimum touch targets, labels on every input, `aria-label` on icon-only buttons.
