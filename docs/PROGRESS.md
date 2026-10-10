# Progress

## Status

**Phase 0 (foundations and design system): complete, awaiting human review.**
Next: Phase 1 (auth, spaces and app shell). Do not start it in the same session unless asked.

## What exists

- pnpm workspace: `apps/web` (Next.js 16, Tailwind v4, Turbopack), `apps/collab` (Node + TS, `/health`), `packages/ui` (design system), `packages/editor`, `packages/db` (empty shells), `packages/config` (tsconfig bases, eslint flat config).
- Design system: tokens copied to `packages/ui/src/tokens.css`, component styles in `packages/ui/src/styles.css`, 21 components and the 10 sticker pack.
- Theme: `day | midnight | auto`, `scraps-theme` cookie, server renders the cookie value, inline head script resolves `auto` before first paint, `useTheme()` and a cross-fade on change.
- Copy module `apps/web/src/copy/en.ts` with `t(key, vars, { night })`, greeting period logic, `**phrase**` highlight markup.
- `/styleguide` (404 when `VERCEL_ENV=production`): tokens with measured contrast, type scale, every component, daylight and after midnight side by side, working header toggle.
- Spikes: Serwist (`/spike/sw`) and local Supabase stack. Findings in `DECISIONS.md`.
- CI workflow `.github/workflows/ci.yml`.

## How to run

| Command | Does |
|---|---|
| `pnpm dev` | web on :3000, collab on :1234, local Supabase (needs Docker Desktop running) |
| `pnpm check` | typecheck, lint, unit tests across the workspace |
| `pnpm e2e` | builds web, runs Playwright (desktop 1440 x 1000 and iPhone 14 profile) |
| `pnpm db:start` / `db:stop` / `db:reset` | local Supabase |

First time on a machine: `pnpm install`, then `pnpm --filter @scraps/web exec playwright install chromium`.

## Verified in this session

- `pnpm check`: typecheck, eslint and 47 unit tests pass (collab 2, ui 29, web 16).
- `pnpm e2e`: 13 passed, 1 skipped by design (SW spike runs on the desktop project only).
- axe (wcag2a/aa, 2.1, 2.2 aa, best-practice): no violations on `/styleguide` in either theme, desktop and phone.
- `pnpm dev`: styleguide 200, collab `/health` ok, Supabase auth health 200.
- Screenshots of both theme panels checked by eye against the artboards.

## Not verified

- **CI has not run on GitHub.** There is no remote yet. The workflow mirrors the local commands, so "CI green on a fresh clone" stays unticked until the first push.
- Android Chrome / desktop Chrome install prompts (Phase 6).
- Real-device rendering (iOS Safari, Android). Only Chromium with an iPhone 14 profile was exercised.

## Known issues and notes

- `@swc/core` (a dependency of `@serwist/turbopack`) prints a postinstall warning about its wasm fallback on Windows. Its native binary works; the SW spike passes.
- Docker Desktop was not running at the start of the session and had to be started for the Supabase spike.
- Local mail catcher is **Mailpit** (`http://127.0.0.1:54324`), not Inbucket as the Phase 1 doc says.
- Next.js 16.4 generated `apps/web/AGENTS.md` (pointer to its bundled docs). Kept.

## Needed before later phases

| Phase | Needs |
|---|---|
| 1 | Google Cloud OAuth client (for Google sign-in); Supabase cloud project only needed for staging |
| 8 | Groq API key |
| 9 | Answers to open questions 4 and 5 in `DECISIONS.md`; Sentry, Vercel, Railway accounts |
