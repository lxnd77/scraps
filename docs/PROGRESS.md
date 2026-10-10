# Progress

## Status

| Phase | State |
|---|---|
| 0 Foundations and design system | complete |
| 1 Auth, spaces and app shell | **complete, awaiting human review** (Google sign-in needs credentials to verify) |
| 2 Editor core and collab server | next |

Do not start the next phase in the same session unless asked.

## What exists

- **Workspace:** `apps/web` (Next.js 16, Turbopack), `apps/collab` (health only until Phase 2), `packages/ui`, `packages/db`, `packages/editor` (empty), `packages/config`.
- **Database** (`supabase/migrations/20261010120000_phase1_schema.sql`): every table from SPEC 11.2, RLS on all of them, `space_role()` / `note_role()` helpers, metadata last-write-wins trigger, asset and transcript triggers, private `media` bucket with note-keyed policies, `space_note_counts()`.
- **Seed** (`supabase/seed.sql`): `dev@scraps.test` owns the five design spaces; `maya@scraps.test` has her own brain dump, is an editor in "side quests" and a viewer in "moodboards".
- **Auth:** magic link (cross-device `token_hash`) and Google (needs credentials), `proxy.ts` session refresh and route protection, sign-in page, onboarding with age gate, brain dump creation.
- **Shell:** desktop sidebar, phone top bar and tab bar with raised capture button, tablet drawer, board header with greeting and night copy, create / rename / recolour spaces, spaces and lists pages, settings (profile, theme, tidy mode, sign out), not-found page.
- **Theme:** cookie plus `profiles.theme`, applied on sign-in from the profile.

## How to run

| Command | Does |
|---|---|
| `pnpm dev` | web :3000, collab :1234, local Supabase (Docker Desktop must be running) |
| `pnpm check` | typecheck, lint, unit tests |
| `pnpm db:test` | pgTAP policy and trigger tests |
| `pnpm e2e` | builds web, runs Playwright against the local stack (needs `pnpm db:start`) |
| `pnpm db:reset` | rebuild the local database from migrations and seed |
| `pnpm db:types` | regenerate `packages/db/src/types.ts` |

First time: `pnpm install`, copy `apps/web/.env.example` to `apps/web/.env.local`, `pnpm --filter @scraps/web exec playwright install chromium`.
Local mail (magic links) is in Mailpit: http://127.0.0.1:54324. Sign in as `dev@scraps.test` or `maya@scraps.test`.
After editing `supabase/config.toml` or the email template, run `pnpm db:stop && pnpm db:start`; `db:reset` does not reload auth config.

## Verified in this session

- `pnpm check`: typecheck, eslint, 55 unit tests (collab 2, db 7, ui 29, web 17).
- `pnpm db:test`: 61 pgTAP assertions across 2 files (viewer / editor / owner / stranger matrix, `note_docs` locked, media paths, last-write-wins, transcripts, asset moves, counts, anon).
- `pnpm e2e`: 41 passed, 1 skipped by design. Desktop 1440 and iPhone 14: sign-in redirects, bad email, bad link, magic link, onboarding validation, under-16, create / rename / recolour space, theme persisted across a full sign-out with cookies cleared, tidy mode, privacy between two users, seeded users, shell layout per breakpoint, axe in both themes on sign-in, board, settings, spaces.
- Screenshots of desktop, tablet (with drawer) and phone in both themes checked against the artboards; two layout bugs found and fixed that way (sidebar overflow, header actions wrapping).

## Not verified

- **Google sign-in end to end.** The button and callback are built; it needs a Google Cloud OAuth client. Redirect URI for local: `http://127.0.0.1:54321/auth/v1/callback`; set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, then set `enabled = true` under `[auth.external.google]` in `supabase/config.toml`.
- **CI on GitHub** (no remote yet). The workflow now starts Supabase, runs `db:test` and the e2e suite.
- Real iOS Safari and Android devices.
- Tablet layout is checked by eye only; the e2e suite covers 1440 and 390.

## Known issues and notes

- The new-scrap buttons, switch-layout and search field are present but disabled placeholders until Phase 3.
- The streak card shows real copy with a count of 0 until Phase 3 computes it.
- An under-16 sign-up leaves a bare `auth.users` row (see DECISIONS, Phase 9 follow-up).
- Docker Desktop must be running for the local stack; the Phase 1 doc says Inbucket but the CLI now ships Mailpit.

## Needed before later phases

| Phase | Needs |
|---|---|
| 1 sign-off | Google Cloud OAuth client (above) |
| 8 | Groq API key |
| 9 | Answers to open questions 4 and 5 in `DECISIONS.md`; Sentry, Vercel, Railway accounts |
