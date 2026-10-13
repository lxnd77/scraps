# Progress

## Status

| Phase | State |
|---|---|
| 0 Foundations and design system | complete |
| 1 Auth, spaces and app shell | complete (Google sign-in needs credentials to verify) |
| 2 Editor core and collab server | complete |
| 3 Board, cards and quick capture | complete |
| 4 Rich media blocks | complete |
| 5 Live co-editing and sharing | complete |
| 6 Offline and PWA | complete |
| 7 Share-sheet capture | **complete except the signed `.shortcut` file, awaiting human review** |
| 8 AI | **complete except the live vendor checks (needs `ANTHROPIC_API_KEY` and a Groq key), awaiting human review** |
| 9 Polish and launch | **built and tested locally; not launched.** Needs a human: deploy, hosted Lighthouse, screen reader pass, social card, real Sentry, legal review |

Do not start the next phase in the same session unless asked.

## What exists

- **Workspace:** `apps/web` (Next.js 16), `apps/collab` (Hocuspocus), `packages/ui`, `packages/db`, `packages/editor`, `packages/config`.
- **Database:** every table from SPEC 11.2 with RLS. Phase 2 added `store_note`, `note_access`, `space_access`, `notes.props` and per-field metadata last-write-wins.
- **Collab server** (`apps/collab`): JWKS token verification, role check per note (viewers are read-only), debounced store with immediate flush on last disconnect, preview extraction on every store, `POST /notes` (JWT or internal secret, idempotent, CORS), `/health`, graceful shutdown, esbuild bundle.
- **Editor** (`packages/editor`): one schema shared by server and browser (`title block+`; paragraph, headings 1 to 3, bullet and numbered lists, checklist with assignee and due, callout, big text, divider, code, table; bold, italic, strike, code, highlight, link; stable block ids), preview extractor, initial documents, Yjs helpers. Browser side: checkbox and callout node views, "drop a block" slash menu (12 items, filter, keyboard, aria-activedescendant), "+" and drag handle gutter, phone block toolbar, click-below-to-continue.
- **Note page** `/n/[noteId]`: top bar (breadcrumb, toggle, live sync chip, share placeholder, more), property chips (vibe, when, tags), editor, more menu (card colour, pin, soft delete), view-only mode, not-yours page.
- **Board** (`components/board`): an infinite canvas (`board/canvas`, since the Oct 13 feedback round) with shared snap-to-grid positions, pan/zoom/pinch, board stickers and drag-to-move between spaces; filter chips with counts (non-matching cards dim); compact list layout (paged, ordered) remembered per device; tidy mode; card menu (right click, more button: pin, colour, delete); arrow keys, `P`, `.`, `m`, Alt+arrows. Checklist boxes on cards go through `POST /notes/:id/checklist` with optimistic update and rollback.
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
| `pnpm functions` | serve the Edge Functions locally (not part of `pnpm dev`) |
| `pnpm ai:check` | says why suggestions are not working: functions served, `ai-sort` answering, `ANTHROPIC_API_KEY` set |

First time: `pnpm install`, copy `apps/web/.env.example` to `apps/web/.env.local` and `apps/collab/.env.example` to `apps/collab/.env.local`, then `pnpm --filter @scraps/web exec playwright install chromium`.
Local mail is in Mailpit (http://127.0.0.1:54324). Sign in as `dev@scraps.test` or `maya@scraps.test`.
After editing `supabase/config.toml`, run `pnpm db:stop && pnpm db:start`; `db:reset` does not reload auth config.

## Feedback round (Oct 13)

Owner feedback after Phase 9, planned and approved in session; all on `main`.

- **Fixes:**
  - modal dialogs are centred again (Tailwind's preflight zeroed the UA margin)
  - dropped pictures land again (the new "add a block" button covered the editor's last 20px)
  - Firefox gets install steps: Android menu, Windows 143+ taskbar, a note elsewhere
- **Suggestions:**
  - `ai-sort` returns why there was no suggestion, and answers 503 `ai_unconfigured` without a key
  - the toast says when suggestions are off or not set up, and the dev console logs the reason
  - `pnpm ai:check` diagnoses the setup
  - locally the cause was a missing `ANTHROPIC_API_KEY` in `supabase/functions/.env`
- **Speed:**
  - `loading.tsx` skeletons on `/s/[spaceId]` and `/n/[noteId]` (about 80 ms to feedback in a production build)
  - pages verify the JWT with `getClaims` (`requireViewer`) instead of two more `getUser` calls
  - shell and page data load in one parallel batch
- **Editor:**
  - "+" block picker (phone toolbar and "add a block" under every scrap); the phone toolbar's media buttons work
  - selection bubble with highlight colours
  - callout swatches use the shared `Swatches`
  - floating stickers in the Y.Doc
- **Colour picker** also in quick capture ("colour by kind" or a colour) and the scrap's top bar.
- **Shortcuts:** `?` cheat sheet (also in the sidebar), `/`, `t`, `g` sequences, `1`–`9`, `[` `]`, `.`, `m`, Alt+arrows, `+` `-` `0` `f`, Esc out of a scrap.
- **Canvas board**, drag-to-move between spaces, and board stickers: see SPEC 6.1 and DECISIONS.
  - migration `20261013150000_canvas.sql`: `notes.board_pos`, `set_board_positions`, `board_stickers`
  - pgTAP `12_canvas`

### Verified (feedback round)

- `pnpm check`:
  - typecheck, lint and unit tests pass
  - test counts: db 147, ui 44, editor 69, collab 49, web 160
  - new tests: canvas layout and viewport, shortcuts, install detection, sticker transforms, the Y.Doc sticker map, `insertBlock`, ai-sort reasons
- `pnpm db:test`:
  - the new `12_canvas` passes (15 assertions)
  - on a database full of e2e rows, `05_media` #5 and `07_capture` #7 fail because they count table-wide rows; they pass after a clean `db:reset`, which was not run, to keep the local data
- `pnpm e2e` (full run, local stack): 137 passed, 30 skipped by design, 1 failed. The failure was `editor › more menu` (reload raced the pin write under load); it then passed 5 of 5 on its own.
- Bugs found by the e2e runs and fixed:
  - the sticker layer's `aria-label` on a plain `div` (axe)
  - the "add a block" button covering dropped pictures
  - the capture "auto colour" label containing "pic"
  - the canvas container being scrollable, which made clicks miss on phones
- e2e changes:
  - specs find cards by text, not order
  - filters dim instead of hiding
  - `settled()` after reloads
  - `bringIntoView()` before clicking on a card
- Browser pane, dev server:
  - drag and snap, persisted after a reload
  - first-drag freeze written in one call
  - pan, Ctrl+wheel, fit, `0`
  - Alt+arrows announced
  - capture lands in view
  - touch: swipe pans, long press drags, pinch clamps at 200%
  - drop strip and sidebar drop, with undo
  - `m` from the keyboard
  - board sticker add, drag, `]`, handle resize, Delete, checked in the database
  - floating sticker persists and syncs to a second tab
  - Firefox how-to unit tested
  - dialog centring measured
  - `pnpm ai:check` found the missing key

### Interface review (better-interface), same day

The review covered the board, its layout, the phone keyboard, settings navigation and shortcuts. It found seven high-severity issues, all fixed. The details and reasons are in DECISIONS.

- **Bounded panning:** the board can't be panned away, and "back to your scraps" fits it when no card is in view.
- **Board pages don't scroll** on tablet and desktop.
- **Phone toolbar** moved clear of the tab bar.
- **On-screen keyboard:** `viewport-fit=cover`, `interactive-widget=resizes-content`, and `KeyboardInset` for iOS.
- **Profile row** in the sidebar, linking to settings.
- **Filtered-out cards are `inert`.**
- **Tap paths for moving** (WCAG 2.5.7): "move it on the board" and "move to another space" in the card menu.
- **Writing and polish:** the toolbar is named "board tools", and the sticker handle lost its prohibited `aria-label`.
- **Live-site fonts:** the local dev server had cached a failed Bricolage download and served only the fallback. The production build and the live site load Bricolage; restarting `pnpm dev` fixes it locally.
- **New e2e** in `canvas.spec.ts`:
  - real-mouse drag
  - drop on another space with undo
  - page height and wheel bounds
  - sidebar to settings
  - tap-to-place and the menu move
  - inert filtered cards
  - phone toolbar position

### Not verified (feedback round)

- Firefox on Windows: the add-to-taskbar steps were written from Mozilla's docs, not tried on a machine.
- Hosted: `getClaims` verifies locally only with asymmetric JWT keys (the cloud project's collab JWKS setup suggests so; local HS256 still asks the auth server).
- Real touch hardware for long press, pinch and sticker handles. They were exercised with synthetic touch pointer events in the browser pane.
- Big spaces near the 2000-card cap. Culling starts at 150 cards and has a unit test, but no load test.
- The collab server must be redeployed with the new editor package. Older clients ignore the stickers map.

## Phase 9: polish, hardening and launch

- **Trash:** `/s/[space]/trash` (link on the board header, and under the search field below 1024px). Editors and owners restore, only the owner deletes forever or empties the trash, both behind a confirm dialog. `purge-trash` removes files first, then rows; pg_cron runs it daily at 03:10 UTC for anything deleted over 30 days ago, and the same run deletes sign-ups that never finished onboarding after 7 days.
- **Account deletion:** settings → account → delete account. Shared spaces you own need an answer each (hand to an editor, or delete for everyone), the display name is typed to confirm, and `delete-account` refuses with 409 before touching anything if an answer is missing.
- **Export:** settings → your data → export everything. The collab server builds a zip (one Markdown file per scrap with front matter under `notes/<space>/`, media under `media/`, a README), stores it privately and returns a one hour link; 3 a day; media is capped at 40 MB with a count of anything left out.
- **Storage:** meter in settings against the 500 MB soft limit, a warning from 80%.
- **Motion:** the existing hover, checkbox, progress, sheet, theme cross-fade and streak burst were kept; added the six sparkle burst when a checklist on a card is completed. All of it is off under reduced motion.
- **Accessibility:** axe on every route in both themes (sign-in, offline, privacy, terms, home, spaces, lists, settings, a space, its trash, a note) plus the delete-account and opt-in dialogs; `prefers-contrast: more` gives 3px outlines and no tilt.
- **Security:** CSP and headers (`src/lib/csp.ts`), `pnpm check:bundle` secret scan (in CI after the build), a shared rate limiter for the functions that had none, review table below.
- **Monitoring:** Sentry on web (`@sentry/browser`, loaded only with a DSN), collab and functions (one fetch each); every event goes through `scrubEvent`.
- **Launch content:** `/privacy` (names Supabase, Groq, Anthropic, Sentry, Vercel, Railway), `/terms` placeholder, legal links on sign-in. `docs/DEPLOY.md` is the runbook, with `railway.json` and `apps/web/vercel.json`.
- **Performance tooling:** `pnpm perf` (needs a production build on :3100, the local stack, collab and Mailpit) signs up a throwaway user and reports board JavaScript weight and Lighthouse scores.

## Verified in this session (Phase 9 additions)

- `pnpm check`: typecheck, lint, unit tests (db 146, ui 40, editor 62, collab 49, web 126).
- `pnpm db:test`: 164 assertions across 11 files after a clean `db:reset`; new `09_trash`, `10_account`, `11_rate_limits`.
- Live on the local stack: the purge function refuses without the secret, removes a 31 day old scrap and its file and keeps a 2 day old one; a 9 day old un-onboarded sign-up is deleted; pg_cron has the job.
- `pnpm e2e`: full run 132 passed, 29 skipped by design, 3 failed; the three were a CSP `connect-src` without `blob:`/`data:` (fixed) and a phone selector in the new a11y spec (fixed); `media`, `share` and `a11y` specs then re-ran 25 of 25 on both projects. New specs: `trash`, `account`, `export`, `a11y`.
- `pnpm check:bundle`: no secrets in `.next/static`; a planted `sb_secret_` string is caught.
- `pnpm audit --prod`: no known vulnerabilities.
- Lighthouse (local production build, mobile profile, simulated 4G): board performance 93, accessibility 100, best practices 100, LCP 3.1 s, TBT 140 ms, CLS 0.003. Note page performance about 70, accessibility 100.
- Board JavaScript: 511 KB to 296 KB gzip after moving the editor, Yjs and the offline prefetch out of the board bundle; 268 KB after dropping zod from the browser bundle (Oct 13, measured from the build manifest, not Lighthouse).

## Security checklist (Phase 9.7)

| Item | Evidence | State |
|---|---|---|
| RLS on every table, with a test | `pnpm db:test`: 164 assertions, 11 files; every table has a policy test (`01_rls` onwards, `09` to `11` this phase) | pass |
| Service role key never in the browser | `pnpm check:bundle` scans `.next/static` for key values, `sb_secret_`, service_role JWTs, private keys; CI runs it after the build; the key is only read in collab and functions | pass |
| Every Edge Function authenticates its caller | capture: hashed bearer token; unfurl-link, ai-sort, delete-account: user JWT checked with `auth.getUser`; transcribe-audio, purge-trash: constant-time internal secret or user JWT with a membership check; no function trusts a client supplied user id | pass |
| Input validation at boundaries | zod in collab and web actions; hand written strict validators in functions (`parseTrashRequest`, `parseDecisions`, `validateSortOutput`, capture body); uuid checks on ids | pass |
| Rate limits | capture 30/min (token), ai-sort 60/h, export 3/day, unfurl 60/min, delete-account 5/h, forever-delete 30/min, transcription retry 20/h | pass (limiter fails open) |
| SSRF | one guard shared by unfurl-link, capture and the image proxy; DNS rebinding between check and fetch is a documented residual risk (DECISIONS phase 4) | known gap |
| CSP and headers | `src/lib/csp.ts`, unit tested; e2e runs under it | pass, with `'unsafe-inline'` scripts (known gap: nonce) |
| Dependencies | `pnpm audit --prod`: no known vulnerabilities | pass |
| Note content never in logs or error reports | `scrubEvent` unit tested (content keys dropped, tokens, emails and queries redacted); collab and function logs carry ids and counts | pass; not seen against a real Sentry project |
| Storage private | `media` and `exports` buckets private, signed urls only, owner-scoped policies | pass |
| Account and data deletion | `delete-account` e2e (solo, transfer, undecided refusal); trash purge live check | pass; backup expiry is a hosting setting |

## Not verified (Phase 9)

- **Anything hosted:** no Supabase, Railway, Vercel, Sentry or DNS account was available. `docs/DEPLOY.md` has not been followed; `pg_cron` and `pg_net` on hosted Supabase, the production CSP against the real origins, and the 03:10 purge job running on its own are all unseen.
- **The production smoke test** (sign up, capture, co-edit, offline, Android share, iOS shortcut, AI suggestion, export): not run. The checklist is in `docs/DEPLOY.md`.
- **Lighthouse on the hosted site** and the **PWA installable** score: local numbers only. Board JavaScript is 296 KB gzip against the 180 KB budget; React and Next are about 105 KB and the Supabase client 89 KB before app code.
- **Note route performance** is about 70 (LCP 5 s locally, measured before the media views were lazy loaded and zod was dropped; not re-measured). The route is 468 KB gzip, mostly the editor.
- **Screen readers:** VoiceOver, TalkBack and NVDA were not run. axe passes, which is not the same.
- **iPhone project for the all routes spec** ran signed out and signed in; the phone layout of the trash and settings dialogs were scanned on desktop only.
- **Sentry delivery:** no DSN was set, so no event has been sent or seen to arrive scrubbed.
- **Export of a very large account** (media over the 40 MB cap, thousands of scraps) and **account deletion with a large space** were not exercised; both run inside one request.
- **App icon variants for both themes** are not made (the social card is, in `apps/web/public/og`); the card has not been seen in a real link unfurl.
- **Legal:** the privacy page and the terms are drafts for a lawyer to review.

## Known gaps worth a ticket

- Replace the full Supabase client on the board with direct PostgREST calls to reach the 180 KB budget.
- Nonce-based CSP through `proxy.ts` to drop `'unsafe-inline'` from `script-src`.
- Lighthouse CI as a job (needs a seeded, signed-in profile).
- Email the export link once a mail provider exists (SPEC 9.9 says emailed).

## Phase 8: transcription and AI suggestions

- **Transcripts:** a new audio `assets` row fires `assets_transcribe_hook` (pg_net) at the `transcribe-audio` Edge Function, which downloads the file, calls the provider named by `TRANSCRIPTION_PROVIDER` (`groq` Whisper large v3 turbo, `openai`, or `fake`) with two retries, and writes `assets.transcript` and the status. The voice block shows "transcribing…", then the transcript (collapsible, "copy into note"), or "retry". The card shows an excerpt, kept in `notes.preview.voice.excerpt` by `store_note` and a trigger. Search finds transcript words through `transcript_tsv`.
- **Suggestions:** `ai-sort` (Claude `claude-haiku-5-5`, plain fetch, no SDK) is called after a capture and from "suggest where this goes" in the note and card menus. It checks `profiles.ai_enabled` on the server, 60 per hour per person, and sends only what SPEC 9.5 lists. Output is validated by hand; anything unusable is "no suggestion". The toast says "file under **space**? add #tag", yes moves the scrap, links or creates tags and titles an untitled scrap (collab `POST /notes/:id/title`, never overwrites); nah dismisses.
- **Opt in:** the first capture shows a dialog saying exactly what is sent; yes and not now are both remembered (`profiles.ai_prompted_at`). Settings has the switch. The first toast carries the one-line notice.
- **Shortcut captures:** `capture` queues a suggestion server side when the person opted in; it waits as a pending `ai_suggestions` row and shows as a toast the next time the app opens.
- **Backfill:** `POST /functions/v1/transcribe-audio` with `x-internal-secret` and `{"backfill": true}` transcribes up to 50 audio assets still `none` or `pending` and older than two minutes. Run it once after deploying.
- **Evals:** `pnpm evals:ai-sort` (needs `ANTHROPIC_API_KEY`; `--min 0.8`, `--verbose`): 30 fixture scraps across the five seed spaces.

## Verified in this session (Phase 8 additions)

- `pnpm check`: typecheck, lint, unit tests (db 120, ui 38, editor 57, collab 42, web 120).
- `pnpm db:test`: new `08_ai.test.sql` (16 assertions): guard trigger, pending on insert, excerpt survives a store, rate function 60 then refused, service-role-only tables, realtime membership.
- Live smoke on the local stack: audio asset row, then the pg_net hook, then the function (202), then the fake provider, then transcript `done`.
- `pnpm e2e`: 110 passed, 26 skipped by design, 2 failed in the full run. The AI search step needed a wait for the board to hydrate (fixed), and `media.spec` "a dropped picture" hit a one-off `Failed to fetch` under load; both pass on re-run (`ai.spec` and `media.spec` together, desktop, 13 of 13). `signUpAndOnboard` now answers the AI prompt through settings so older specs are not blocked by the opt-in dialog.
- `e2e/ai.spec.ts` (desktop and iPhone 14): opt-in, suggestion, yes files the scrap with its tag; nah moves nothing; no call when off and asked once; malformed, empty and 500 answers show nothing; the settings switch; a voice memo gets its transcript and search finds a word from it. The function is mocked with `page.route` and service workers are blocked (otherwise the worker answers past the mock).

## Not verified (Phase 8)

- **Real vendors:** Groq transcription and Claude suggestions were not called (no keys). The 30 second budget, transcript quality, prompt accuracy and the eval score are unknown until `pnpm evals:ai-sort` and a real memo run with keys.
- **Hosted setup:** `app_config` (`functions_url`, `internal_secret`, optional `functions_apikey`) must be set by hand on the hosted project and `pg_net` enabled. Until then new memos stay `pending` and the backfill picks them up.
- **A memo recorded offline:** the asset row arrives with the outbox and the block polls for five minutes. Not exercised.
- **Languages:** no language hint is sent, so Whisper detects it (DECISIONS question 5).
- **Shortcut path end to end:** `afterCapture` runs through the shared, unit tested service; no live call was made from the `capture` function.
- **Tag colours:** accepted tags are created lilac, as the manual add does.

## Phase 7: share-sheet capture

- **Share target:** manifest `share_target` (title, text, url, image and audio files). The service worker answers `POST /share-target` itself, parks the payload in IndexedDB and redirects to `/?capture=<id>`, so it works offline. The capture sheet opens prefilled: link (unfurled), one pic, two or more pics as a mood board, text, or a decoded audio file as a voice memo. The payload is cleared on save and on cancel.
- **Drop:** files, links or text dropped anywhere in the signed-in app open the sheet prefilled, with a dashed overlay while dragging.
- **Capture tokens:** settings → capture creates a token (shown once, copy button), lists them with last used time, revokes with an inline confirm. Ten live tokens at most.
- **`capture` Edge Function:** bearer token, 30 per minute, JSON or multipart with one JPEG/PNG (EXIF stripped, orientation kept), unfurls links through the SSRF guard, creates the note through the collab server in the default capture space, returns `{ noteId, url }`. `afterCapture()` is the Phase 8 hook.
- **Settings** also carry the endpoint and step-by-step shortcut instructions.

## Verified in this session (Phase 7 additions)

- `pnpm check`: typecheck, lint, unit tests (db 84, ui 38, editor 57, collab 38, web 113).
- `pnpm e2e`: 101 passing, 25 skipped by design (desktop-only flows on the phone project), including the new `share.spec.ts`.
- `pnpm db:test`: new `07_capture.test.sql` (15 assertions) passes. `05_media.test.sql` assertion 5 ("users can read link previews") fails on this laptop because the dev database already holds a link preview row from the demo seed; this phase does not touch it.
- `pnpm test:int`: 5 passing.
- Live `capture` calls against the local stack: text (201), link (201, unfurled), JPEG with EXIF (201, asset row written with size), WebP (415), empty body (400), private address (422, `blocked_ip`), unknown token (401), 30 calls then 429, revoked token (401).
- `e2e/share.spec.ts` (production build, service worker): shared link opens the sheet as a link scrap and saves, three shared pictures become a mood board with three images, a share made offline is queued and syncs, a dropped picture opens the sheet, tokens can be made, used, listed and revoked (401 after).

## Bug found by the tests and fixed in this phase

- `Outbox.flush()` returned at once when a run was already in progress, so "flushed" did not mean delivered and the board refetch after a capture could run before the create reached the server (the new card vanished until the next refetch). It now waits for the run in progress, including the extra pass.

## Not verified (Phase 7)

- **A real share sheet** on Android Chrome or desktop Edge with the app installed (the e2e posts the same multipart form from the page), and the YouTube app's exact share fields.
- **The Apple Shortcut.** The `.shortcut` file has not been built or signed (needs an Apple device), no screenshots exist, and nothing has been tried from iOS Safari or the Photos app. The function accepts the JSON and multipart shapes the steps describe.
- **HEIC from the shortcut:** the steps say to convert to JPEG first; a HEIC upload is refused with 415.
- **Sharing while signed out:** the sign-in redirect drops the share id, so the parked payload is not recovered after signing in (it expires in 24 hours).
- **Large shares:** nine full-size photos are processed one after another in the browser; not timed on a phone.
- **Rate limit window** is a fixed minute, so a burst across a boundary can allow up to 60 calls in a few seconds.
- **The Realtime hand-off** (7.8) relies on the Phase 5 board subscription; the e2e checks the board after a navigation, not a second open window.

## Phase 6: offline and PWA

- **Installable:** manifest (standalone, shortcut "new scrap"), generated icons incl. maskable, theme colours, service worker on every page in production, install prompt (Android and desktop native, iOS how-to sheet) and a settings row.
- **Offline reading:** pages and Next data cached network-first, offline fallback page, persisted board and counts, notes opened or prefetched (up to 50, recent first) open from IndexedDB.
- **Offline writing:** notes, metadata, tags, card ticks, pictures and recordings go through the outbox and replay in order with backoff.
- **Status:** one sync chip (saved, syncing, offline, error) in the shell and on the note, a dashed first-offline banner, a warning for work older than 24 hours, `navigator.storage.persist()` on start.
- **Search offline:** the palette falls back to cached cards and says "searching this device only".

## Verified in this session (Phase 6 additions)

- `pnpm check`: 281 unit tests (db 61, ui 38, editor 57, collab 38, web 87).
- `pnpm e2e`: 96 passing, 20 skipped by design (desktop-only on the phone project). New `offline.spec.ts`: installable and controlled by the service worker (Chromium installability check clean), hard reload with no network shows the board, edit a note offline then reload and sync, two scraps (one with a picture) plus a card tick made offline arrive once on a fresh session, no tick offline for a note never opened, two people editing the same paragraph with one offline both survive.

## Not verified (Phase 6)

- **A real install** on Android Chrome or iOS, a Lighthouse PWA run, and how iOS evicts storage for a non-installed site.
- **Long outages**: the 24 hour warning is unit tested as a derivation, not waited for.
- **Large offline backlogs** (many pictures): blobs sit in IndexedDB until uploaded; quota behaviour was not exercised.
- **Navigating to a page never visited online** while offline falls back to the offline page by design.
- **Two devices offline at once** editing the same note: the merge is Yjs's, tested with one side offline.

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
| 7 sign-off | A person with an iPhone to build, export and host the `Send to Scraps` shortcut and take its screenshots, then set `NEXT_PUBLIC_SHORTCUT_URL` |
| 8 sign-off | Groq API key (`TRANSCRIPTION_API_KEY`, provider `groq`) and Anthropic API key (`ANTHROPIC_API_KEY`) in the Edge Function secrets; then `pnpm evals:ai-sort` and a real 20 second memo |
| 9 | Answers to open questions 4 and 5 in `DECISIONS.md`; Sentry, Vercel, Railway accounts |
