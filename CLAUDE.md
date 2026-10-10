# Scraps: instructions for Claude Code

Scraps ("scraps." in the logo) is a loud, Gen-Z note-taking app: Notion-style block pages, but every note is a colourful card on a messy board. Notes can be text, checklists, images, links, voice memos and stickers. It ships as a web-first PWA with live co-editing, offline editing, share-sheet capture and AI help.

Read this file at the start of every session. It is short on purpose. The details live in:

| File | What it holds |
|---|---|
| `docs/SPEC.md` | Product and design spec: screens, components, tokens, behaviour, data model, architecture, security |
| `docs/tokens.css` | The design tokens for both themes. Copy into the app as the single source of colour, type, radius and shadow |
| `docs/PLAN.md` | Phase overview and the order of work |
| `docs/phases/NN-*.md` | One file per phase: tasks, acceptance criteria, tests |
| `docs/DECISIONS.md` | Confirmed stack, recorded decisions, open questions |
| `docs/design-reference/` | Source of the 10 design artboards (daylight and after midnight). Read them for exact layout, copy and spacing |
| `docs/PROGRESS.md` | You create and maintain this: what is done, what is next, known issues |

## How to work a phase

1. Read `CLAUDE.md`, `docs/PROGRESS.md` (if it exists), the phase file, and only the `SPEC.md` sections that phase file lists.
2. Write a short plan (files to touch, migrations, tests) before changing code. Use plan mode for anything touching the database schema, auth or the collab server.
3. Work task by task. Commit after each task with a conventional commit message (`feat(board): filter chips`).
4. Run `pnpm check` (typecheck, lint, unit tests) before every commit. Run `pnpm e2e` before closing a phase.
5. Close the phase by ticking its acceptance criteria in the phase file, updating `docs/PROGRESS.md`, and stopping with a summary for human review. Do not start the next phase in the same session unless asked.
6. If a task needs a decision the docs do not cover, pick the simplest option that fits the spec, record it in `docs/DECISIONS.md` under "Decisions made during build", and flag it in the phase summary.

## Stack (confirmed, see DECISIONS.md)

- **Monorepo:** pnpm workspaces. Node 22 LTS or newer.
- **Web app:** `apps/web`: Next.js 16 (App Router, React Server Components where useful, TypeScript strict), Tailwind CSS v4 with tokens from `docs/tokens.css`, `next/font` for Bricolage Grotesque and JetBrains Mono, lucide-react icons at stroke width 2.4, Motion (framer-motion successor) for micro-interactions.
- **Editor:** `packages/editor`: Tiptap v3 (MIT packages only, no Tiptap Cloud or Pro), Yjs, y-prosemirror via `@tiptap/extension-collaboration` and collaboration caret. Shared by the web app and the collab server so both use one schema.
- **Collab server:** `apps/collab`: Hocuspocus 4 (Node, WebSocket). Verifies Supabase JWTs, checks space membership, persists Yjs updates to Postgres, extracts card previews.
- **Backend:** Supabase: Postgres with RLS on every table, Auth (email magic link and Google), Storage (private `media` bucket), Edge Functions (Deno) for link unfurl, transcription, AI sort and token capture.
- **Client data:** TanStack Query for server state, persisted to IndexedDB. `y-indexeddb` for offline note content. A small outbox for queued mutations and uploads.
- **PWA:** Serwist service worker, web app manifest with `share_target`.
- **AI:** Claude API, model `claude-haiku-5-5`, for auto-sort and tag suggestions. Speech-to-text behind a `TranscriptionProvider` interface (default provider set in DECISIONS.md).
- **Testing:** Vitest (unit, components with Testing Library), Playwright (e2e, two-browser collab tests), Supabase CLI local stack with SQL tests for RLS.
- **Hosting:** Vercel (web), Railway (collab server), Supabase cloud. GitHub Actions for CI.

Use the latest stable version of each package at install time. If a library API differs from what the docs here assume, follow the library's current docs and note it in DECISIONS.md.

## Repo layout

```
apps/
  web/          Next.js PWA
  collab/       Hocuspocus server
packages/
  editor/       Tiptap extensions, schema, block node views (React), preview extraction
  ui/           Design-system components (Button, Chip, Card, ThemeToggle...)
  db/           Generated Supabase types, typed query helpers, zod schemas
  config/       Shared tsconfig, eslint, tailwind preset
supabase/
  migrations/   SQL migrations (never edit an applied migration; add a new one)
  functions/    Edge Functions
  tests/        SQL tests for RLS
  seed.sql      Demo content matching the design reference
docs/           This kit
```

## Commands (create these in Phase 0)

- `pnpm dev`: web app, collab server and Supabase local together
- `pnpm check`: typecheck, lint, unit tests across the workspace
- `pnpm e2e`: Playwright suite against the local stack
- `pnpm db:reset`: reset local DB, apply migrations, run seed
- `pnpm db:types`: regenerate `packages/db` types from the local schema
- `pnpm db:test`: run SQL tests in `supabase/tests`

## Non-negotiable rules

**Design**
- Never hard-code a colour, radius, shadow or font in a component. Use the CSS variables from `tokens.css` (through Tailwind theme values or `var(--...)`). Both themes must work for every component you build.
- The look is neo-brutalist: 2.5px solid outlines, hard offset shadows with zero blur, chunky rounded corners, slight card tilts. No gradients, no blur shadows, no glassmorphism, no emoji in UI (stickers are SVG).
- UI copy is lowercase, short and playful, in the voice of `SPEC.md` section 4. Proper nouns and user content keep their case.
- Touch targets are at least 44 by 44 px. Text meets WCAG AA contrast in both themes (the token pairs in `tokens.css` already do; keep to those pairs).
- Every interactive element is a real `<button>`, `<a href>` or form control with a visible focus ring. Icon-only buttons get an `aria-label`.

**Data and security**
- Every table has RLS enabled with explicit policies. Add a SQL test in `supabase/tests` for each policy.
- The Supabase service-role key is used only in Edge Functions and the collab server, never in `apps/web` client code or `NEXT_PUBLIC_*` variables.
- Note content lives in Yjs documents. Only the collab server writes `note_docs`. The web app never writes note content through PostgREST.
- Note IDs and asset IDs are UUIDs generated on the client (v7), so offline-created items keep their IDs when they sync.
- Edge Functions that fetch user-supplied URLs must block private and link-local IP ranges, cap response size and time out (see SPEC.md section 11).

**Code**
- TypeScript strict, no `any` without a comment saying why. Validate external input with zod at boundaries (route handlers, Edge Functions, collab hooks).
- Keep components small. Block node views live in `packages/editor`, page-level composition in `apps/web`.
- Add a dependency only if it saves real work. Record new runtime dependencies in DECISIONS.md with one line of reasoning.
- Write tests with the feature, not after. Each phase file lists the minimum set.
