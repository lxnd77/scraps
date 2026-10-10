# Progress

## Status

| Phase | State |
|---|---|
| 0 Foundations and design system | complete |
| 1 Auth, spaces and app shell | complete (Google sign-in needs credentials to verify) |
| 2 Editor core and collab server | **complete, awaiting human review** |
| 3 Board, cards and quick capture | next |

Do not start the next phase in the same session unless asked.

## What exists

- **Workspace:** `apps/web` (Next.js 16), `apps/collab` (Hocuspocus), `packages/ui`, `packages/db`, `packages/editor`, `packages/config`.
- **Database:** every table from SPEC 11.2 with RLS. Phase 2 added `store_note`, `note_access`, `space_access`, `notes.props` and per-field metadata last-write-wins.
- **Collab server** (`apps/collab`): JWKS token verification, role check per note (viewers are read-only), debounced store with immediate flush on last disconnect, preview extraction on every store, `POST /notes` (JWT or internal secret, idempotent, CORS), `/health`, graceful shutdown, esbuild bundle.
- **Editor** (`packages/editor`): one schema shared by server and browser (`title block+`; paragraph, headings 1 to 3, bullet and numbered lists, checklist with assignee and due, callout, big text, divider, code, table; bold, italic, strike, code, highlight, link; stable block ids), preview extractor, initial documents, Yjs helpers. Browser side: checkbox and callout node views, "drop a block" slash menu (12 items, filter, keyboard, aria-activedescendant), "+" and drag handle gutter, phone block toolbar, click-below-to-continue.
- **Note page** `/n/[noteId]`: top bar (breadcrumb, toggle, live sync chip, share placeholder, more), property chips (vibe, when, tags), editor, more menu (card colour, pin, soft delete), view-only mode, not-yours page.
- **Board:** "new scrap" starts a blank scrap (desktop button, empty state, phone "+"); the board lists the space's scraps (title, preview, word count, edited time) as a temporary list.

## How to run

| Command | Does |
|---|---|
| `pnpm dev` | web :3000, collab :1234, local Supabase (Docker Desktop must be running) |
| `pnpm check` | typecheck, lint, unit tests (no services needed) |
| `pnpm db:test` | pgTAP policy and trigger tests |
| `pnpm test:int` | collab integration tests (needs `pnpm db:start`) |
| `pnpm e2e` | builds web, starts collab, runs Playwright (needs `pnpm db:start`) |
| `pnpm db:types` | regenerate `packages/db/src/types.ts` after a migration |

First time: `pnpm install`, copy `apps/web/.env.example` to `apps/web/.env.local` and `apps/collab/.env.example` to `apps/collab/.env.local`, then `pnpm --filter @scraps/web exec playwright install chromium`.
Local mail is in Mailpit (http://127.0.0.1:54324). Sign in as `dev@scraps.test` or `maya@scraps.test`.
After editing `supabase/config.toml`, run `pnpm db:stop && pnpm db:start`; `db:reset` does not reload auth config.

## Verified in this session

- `pnpm check`: typecheck, eslint, 135 unit tests (db 10, ui 29, editor 47, collab 23, web 26).
- `pnpm db:test`: 76 pgTAP assertions across 3 files.
- `pnpm test:int`: 5 integration tests against the local stack (real ES256 tokens via JWKS, stored previews, full-text search, streak day, strangers refused, viewers read-only, removal revokes access).
- `pnpm e2e`: 61 passing (desktop 1440 and iPhone 14), 1 skipped by design. Editor coverage: write, checklist, callout, reload; card reflects saved content; slash menu filter, arrows, enter, escape; markdown shortcuts; title and backspace guard; stranger gets the not-yours page; more menu colour, pin, delete; tags and chips persist; checklist toggles from the keyboard; axe in both themes.
- Headless Tiptap test that every one of the 12 slash items inserts its block and still satisfies the schema.
- Screenshots of the editor on desktop and phone in both themes, plus the slash menu and the gutter, checked by eye.

## Bugs found by the tests and fixed in this phase

- Metadata last-write-wins was per row, so two quick writes to different fields could lose one (now per field, in the database).
- The editor wrote a default paragraph before the first sync, leaving a stray block in every note (now mounts after sync; trailing-node plugin off).
- The checklist node view put a `div` inside the `ul` (axe: list structure).
- The collab production build did not compile (now an esbuild bundle).
- Phase 1 `listSpaces` bug from last phase is covered by the same suite.

## Not verified

- **Google sign-in end to end** (needs a Google Cloud OAuth client; see Phase 1 notes in DECISIONS).
- **CI on GitHub** (no remote). The workflow now exports the Supabase env, runs `db:test`, `test:int` and e2e with collab.
- **Concurrent editing by two people** (Phase 5): the server and provider support it, and a two-client sync test exists in the fast suite, but there is no two-browser e2e and no carets yet.
- Real iOS Safari and Android keyboards: the phone toolbar and touch drag are untested on devices.
- The drag handle's drag-and-drop reordering has no automated test (the gutter renders and shows on hover).
- Load: 10 concurrent editors per note and 1,000 connections per instance are targets, not measured (Phase 5.8).

## Known issues and notes

- The collab server holds live documents in memory, so run **one instance** (see DECISIONS).
- The note page waits for the first sync before showing the editor; with the server down it shows an empty shell and the offline chip. Phase 6 adds local persistence.
- Only the title is shown in the note top bar breadcrumb on phones (space name only), per the phone sub-screen layout.
- Share, image, link, voice and sticker buttons are visible placeholders until Phases 4 and 5.
- An under-16 sign-up leaves a bare `auth.users` row (Phase 9 follow-up).

## Needed before later phases

| Phase | Needs |
|---|---|
| 1 sign-off | Google Cloud OAuth client |
| 8 | Groq API key |
| 9 | Answers to open questions 4 and 5 in `DECISIONS.md`; Sentry, Vercel, Railway accounts |
