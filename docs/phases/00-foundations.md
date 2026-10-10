# Phase 0: Foundations and design system

**Goal:** a monorepo that runs locally and in CI, with the design tokens, fonts, theme switching and core UI components built and visible on a `/styleguide` page in both themes.

**Depends on:** nothing. **Read:** SPEC 3, 4.1, 7, 13; `docs/tokens.css`; artboards `Main` and `Midnight-Main` for component look.

## Tasks

- [ ] **0.1 Workspace.** pnpm workspaces with `apps/web`, `apps/collab` (empty Node + TS app with a health route), `packages/ui`, `packages/editor` (empty), `packages/db` (empty), `packages/config` (tsconfig base, eslint flat config, prettier). TypeScript strict everywhere.
- [ ] **0.2 Next.js app.** `apps/web` on Next.js 16 App Router, `src/` layout, path aliases, Tailwind v4. Import `tokens.css` into the global stylesheet (copy it to `packages/ui/src/tokens.css` and import from there).
- [ ] **0.3 Fonts.** Bricolage Grotesque (variable weight 400 to 800, optical size axis if available) and JetBrains Mono (400, 600) through `next/font/google` with `variable: "--ff-display-loaded"` and `"--ff-mono-loaded"` on `<html>`, so `--ff-display` / `--ff-mono` in `tokens.css` pick them up (Tailwind utilities `font-display` and `font-mono`).
- [ ] **0.4 Theme system.** `ThemeProvider` resolving `day | midnight | auto`; inline `<head>` script reads the `scraps-theme` cookie and `prefers-color-scheme` and sets `data-theme` before paint; server components read the cookie for SSR. Hook `useTheme()` returns `{ theme, resolved, setTheme }`. No flash of the wrong theme on reload (test it).
- [ ] **0.5 Components (`packages/ui`).** Build from SPEC section 7: `Button` (primary, dark, ghost, icon), `Chip` (filter, property, tag, count), `ThemeToggle` (lg and md sizes, `role="switch"`), `Card` (colour prop, tilt from id, hover untilt), `Checkbox`, `ProgressBar`, `Avatar`, `AvatarStack`, `SearchField`, `SyncChip`, `SpaceDot`, `Skeleton`, `Sheet`, `Dialog`, `Menu`, `Toast`, `Tape`, `Sparkle`. Every component reads only CSS variables.
- [ ] **0.6 Sticker pack.** SVG components for the 10 v1 stickers (SPEC 3.6) with ink outlines that use `--on-accent` for line colour inside fills. Redraw from the shapes in the design reference; keep them original.
- [ ] **0.7 Styleguide.** `/styleguide` route (dev and preview builds only) showing tokens (swatches with hex and contrast ratio), type scale, every component variant, both themes side by side, plus the header with the `ThemeToggle` working.
- [ ] **0.8 Tooling.** Vitest + Testing Library in `packages/ui` and `apps/web`; Playwright with a base config (desktop Chrome 1440 x 1000 and an iPhone 14 profile); axe-core check helper for e2e; scripts `pnpm dev`, `pnpm check`, `pnpm e2e`.
- [ ] **0.9 Spikes.** (a) Serwist: register a minimal service worker in a production build of `apps/web` and confirm it controls the page. (b) Supabase CLI local stack starts with `pnpm dev`. Record findings in DECISIONS.md.
- [ ] **0.10 CI.** GitHub Actions: install with cache, `pnpm check`, Playwright on the styleguide, build all apps. Fail on type errors and lint errors.
- [ ] **0.11 Copy module.** `apps/web/src/copy/en.ts` with the string table from SPEC 4.2 and a `t(key, vars, { night })` helper that picks the night variant when the resolved theme is midnight.

## Acceptance criteria
- [ ] `pnpm dev` starts web, collab (health route) and Supabase locally with one command.
- [ ] `/styleguide` renders every component in both themes; toggling the `ThemeToggle` switches the page theme with a cross-fade and persists across reload with no flash.
- [ ] axe reports no violations on `/styleguide` in either theme.
- [ ] No hex colour literals in `packages/ui/src/components` (lint rule or test that greps for `#[0-9a-fA-F]{3,6}` outside `tokens.css` and sticker SVGs).
- [ ] CI is green on a fresh clone.

## Tests (minimum)
- Unit: `ThemeToggle` toggles `aria-checked` and calls `setTheme`; `Card` tilt is stable for the same id; `t()` returns night strings when resolved theme is midnight.
- E2E: styleguide loads, toggle switches `data-theme`, reload keeps it, axe passes.

## Out of scope
Auth, database schema, real data.
