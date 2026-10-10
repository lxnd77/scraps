# Progress

## Status

| Phase | State |
|---|---|
| 0 Foundations and design system | complete |
| 1 Auth, spaces and app shell | complete (Google sign-in needs credentials to verify) |
| 2 Editor core and collab server | complete |
| 3 Board, cards and quick capture | complete |
| 4 Rich media blocks | complete |
| 5 Live co-editing and sharing | **complete, awaiting human review** |
| 6 Offline and PWA | next |

Do not start the next phase in the same session unless asked.

## What exists

- **Workspace:** `apps/web` (Next.js 16), `apps/collab` (Hocuspocus), `packages/ui`, `packages/db`, `packages/editor`, `packages/config`.
- **Database:** every table from SPEC 11.2 with RLS. Phase 2 added `store_note`, `note_access`, `space_access`, `notes.props` and per-field metadata last-write-wins.
- **Collab server** (`apps/collab`): JWKS token verification, role check per note (viewers are read-only), debounced store with immediate flush on last disconnect, preview extraction on every store, `POST /notes` (JWT or internal secret, idempotent, CORS), `/health`, graceful shutdown, esbuild bundle.
- **Editor** (`packages/editor`): one schema shared by server and browser (`title block+`; paragraph, headings 1 to 3, bullet and numbered lists, checklist with assignee and due, callout, big text, divider, code, table; bold, italic, strike, code, highlight, link; stable block ids), preview extractor, initial documents, Yjs helpers. Browser side: checkbox and callout node views, "drop a block" slash menu (12 items, filter, keyboard, aria-activedescendant), "+" and drag handle gutter, phone block toolbar, click-below-to-continue.
- **Note page** `/n/[noteId]`: top bar (breadcrumb, toggle, live sync chip, share placeholder, more), property chips (vibe, when, tags), editor, more menu (card colour, pin, soft delete), view-only mode, not-yours page.
- **Board** (`components/board`): masonry cards by kind (text, list, quote; pic, link and voice use a neutral fallback until Phase 4), filter chips with counts, infinite scroll in pages of 40, compact list layout remembered per device, tidy mode, card menu (right click, long press, more button: pin, colour, move, delete), arrow keys and `P`. Checklist boxes on cards go through `POST /notes/:id/checklist` with optimistic update and rollback.
- **Quick capture** (`components/capture`): sheet on phone, modal on desktop, `N` opens, Ctrl/Cmd+Enter saves; text and list work, other tiles say coming soon.
- **Search:** Ctrl/Cmd+K palette (scraps, spaces, actions), highlighted snippets, full screen on phones. **Streak** card with sparkle burst, **greetings** by hour and theme, **starter scraps** after onboarding.

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

## Phase 5: sharing and live editing

- **Invites and members:** share dialog (members, role select for owners, remove, leave, invite links with role, expiry and max uses, revoke), `/invite/[token]` accept page, invites survive sign-in and onboarding.
- **Presence:** named, coloured carets, top-bar avatar stack, activity box with who is here.
- **Live access changes:** removed members see "you no longer have access" within the 3 s sweep; demoted editors are made read-only and told.
- **Board realtime:** new and edited cards from others appear without reload; sidebar avatar stacks on shared spaces; checklist assignees.
- **Load check** (`node scripts/load-check.mjs`, 10 clients, 120 s, ~2 keys/s each, local stack on a laptop that was also running other work): 2,270 edits, 20,430 deliveries; latency p50 2 ms, p95 10 ms, p99 87 ms, max 592 ms; all clients converged to identical content; collab server RSS peaked at 136 MB with 10 connections.

## Verified in this session (Phase 5 additions)

- `pnpm check`: 254 unit tests (db 61, ui 38, editor 57, collab 35, web 63).
- `pnpm db:test`: 111 assertions across 6 files (18 new for invites and membership). `pnpm test:int`: 5.
- `pnpm e2e`: 90 passing, 14 skipped by design (desktop-only gestures on the phone project). New `collab.spec.ts`: two people typing into one note with named carets, viewer read-only, removal kick, invite max uses and revoke, live board card, axe on the share dialog.

## Not verified (Phase 5)

- **The 1,000-connection target**: 10 clients on a laptop says nothing about it; the role sweep costs one lookup per distinct (note, user) pair per 3 s.
- **Real-device carets and IME composition** while someone else types.
- **Expired invite through the UI**: expiry is covered in SQL tests; the e2e covers max uses and revoke.
- **Realtime across a flaky network**: only the local path is exercised; a reconnect refetches on window focus.
- **The two-person flows on the phone layout** (they run on desktop).

## Phase 4: media

- **Editor blocks:** image (drop, paste, `/img`, caption, alt, polaroid), mood board (2 to 9, reorder, remove), link embed (paste on an empty line, "keep as link"), voice memo (record up to 5 minutes, live peaks, scrub), inline stickers (`:` menu, drawer, drag).
- **Page:** cover (stripes, night illustration, upload), page icon, page outfit accent, right rail (stickers, outfit, activity).
- **Cards:** pic (polaroid, tape, +N pics), link (header, play badge, duration, domain), voice (inline play), quote sticker from the page icon.
- **Capture:** all six tiles work (pic, link, voice, sticker added).
- **Backend:** `unfurl-link` Edge Function, image proxy route, SSRF guard, `link_previews` fields, storage mime allow-list, mood board starter.
- **Demo data:** `pnpm seed:demo` creates one scrap of every kind on dev@scraps.test.

## Verified in this session (Phase 4 additions)

- `pnpm check`: 187 unit tests (db 61, ui 38, editor 57, collab 33, web 58).
- `pnpm db:test`: 93 assertions across 5 files. `pnpm test:int`: 5.
- `pnpm e2e`: 84 passing, 8 skipped by design (desktop-only gestures on the phone project). New `media.spec.ts`: picture drop to webp, link paste and keep-as-link, `:` sticker, voice memo with a fake microphone, pic and link capture from the sheet, cover and icon, axe in both themes with blocks.
- Live `unfurl-link`: example.com and a YouTube link (title, thumbnail, 3:34 duration); `169.254.169.254` refused with `blocked_ip`; a localhost port refused.
- Seeded board checked in desktop day and phone night screenshots.

## Verified earlier (Phase 3)

- `pnpm check`: typecheck, eslint, 135 unit tests (db 10, ui 29, editor 47, collab 23, web 26).
- `pnpm db:test`: 76 pgTAP assertions across 3 files.
- `pnpm test:int`: 5 integration tests against the local stack (real ES256 tokens via JWKS, stored previews, full-text search, streak day, strangers refused, viewers read-only, removal revokes access).
- `pnpm e2e`: 61 passing (desktop 1440 and iPhone 14), 1 skipped by design. Editor coverage: write, checklist, callout, reload; card reflects saved content; slash menu filter, arrows, enter, escape; markdown shortcuts; title and backspace guard; stranger gets the not-yours page; more menu colour, pin, delete; tags and chips persist; checklist toggles from the keyboard; axe in both themes.
- Headless Tiptap test that every one of the 12 slash items inserts its block and still satisfies the schema.
- Screenshots of the editor on desktop and phone in both themes, plus the slash menu and the gutter, checked by eye.

## Phase 3 verification

- `pnpm check`: 165 unit tests (db 10, ui 38, editor 47, collab 30, web 40).
- `pnpm db:test`: 86 assertions across 4 files. `pnpm test:int`: 5 passing.
- `pnpm e2e`: board spec (starters, capture text and list, filters, pin, search into a checklist item, keyboard nav, `N` and Ctrl+Enter, card tick visible in the editor, layout toggle, axe in both themes) plus the Phase 1 and 2 suites, desktop and iPhone 14.
- Search timing: 27 ms for `search_notes` over 5,332 scraps locally (`scripts/seed-perf.sql`, run as the DB owner so RLS cost is not included; target is 300 ms).

## Bugs found by the tests and fixed in this phase

- Metadata last-write-wins was per row, so two quick writes to different fields could lose one (now per field, in the database).
- The editor wrote a default paragraph before the first sync, leaving a stray block in every note (now mounts after sync; trailing-node plugin off).
- The checklist node view put a `div` inside the `ul` (axe: list structure).
- The collab production build did not compile (now an esbuild bundle).
- Phase 1 `listSpaces` bug from last phase is covered by the same suite.

## Not verified (Phase 4)

- **iOS Safari recording** (AAC/MP4) and playback on the other browser; Android Chrome.
- **A real 12 MB iPhone photo**: the under-1-MB result depends on content; HEIC decoding only works in browsers that decode it.
- **SSRF with a real DNS rebinding service**; the guard is unit tested with an injected resolver.
- **Mood board drag-reorder** uses earlier/later buttons, not drag handles; touch drag is untested.
- **Transcripts** are not wired (status stays `none`); the voice block shows none yet.
- **Presence count** in the activity box is fixed at 1 until Phase 5.

## Not verified

- **Board against the artboards** by eye in both themes, and the phone layout on a real device. There is no demo seed script yet; the starter scraps are the only sample content.
- **Long press** on touch for the card menu (timer implemented, not exercised by a test).
- **RLS-inclusive search timing** at 5,000 scraps (measured without RLS).

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
- Streak copy uses the spec's "{n} days" even for 1 in the card title ("streak · 1 days"); the big count reads "1 day".
- Share, image, link, voice and sticker buttons are visible placeholders until Phases 4 and 5.
- An under-16 sign-up leaves a bare `auth.users` row (Phase 9 follow-up).

## Needed before later phases

| Phase | Needs |
|---|---|
| 1 sign-off | Google Cloud OAuth client |
| 8 | Groq API key |
| 9 | Answers to open questions 4 and 5 in `DECISIONS.md`; Sentry, Vercel, Railway accounts |
