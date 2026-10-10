# Decisions

## Confirmed with the product owner (Oct 2026)

| Area | Decision | Why |
|---|---|---|
| Platform | Web-first PWA. Native (Expo) app is a later phase, not v1 | Fastest path to a usable product; the block editor is most mature on the web |
| Backend | Supabase (Postgres, Auth, Storage, Edge Functions) | Relational data (spaces, members, tags) with RLS for privacy; same stack the owner already runs |
| Collaboration | Live co-editing in v1, with presence avatars and carets | The editor design shows shared notes with avatars |
| v1 extras | Voice memo transcription, AI auto-sort and tagging, offline editing, share-sheet capture | All four requested for v1 |

## Stack decisions

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16, App Router, TypeScript strict | Current stable major as of Oct 2026 |
| Styling | Tailwind CSS v4 + CSS variables from `tokens.css` | Tokens switch per theme via `data-theme` on `<html>` |
| Editor | Tiptap v3, MIT packages only | No Tiptap Cloud, no Pro-licensed extensions. Check each `@tiptap/*` package licence at install |
| CRDT | Yjs | One model gives co-editing, offline edits and merge |
| Collab server | Hocuspocus 4, self-hosted | Database extension writes to Postgres; `onAuthenticate` checks Supabase JWT and membership |
| Collab hosting | Railway (default), Fly.io as fallback | Needs a long-lived WebSocket process, so not Vercel |
| Offline storage | `y-indexeddb` for docs, TanStack Query persister on IndexedDB for lists, custom outbox | See SPEC.md section 10 |
| Service worker | Serwist | If Serwist needs webpack with the installed Next version, build the SW with webpack and keep Turbopack for dev; record what was done |
| Auth | Supabase Auth: email magic link + Google | Apple sign-in added with the native app |
| Media | Supabase Storage, private `media` bucket, signed URLs | Images resized client-side before upload (max 2048px long edge, WebP) |
| AI sort and tags | Claude API, `claude-haiku-5-5` | Called from an Edge Function; suggestions are never applied without the user tapping accept |
| Transcription | `TranscriptionProvider` interface. Provider: **Groq Whisper** (confirmed Oct 2026). OpenAI speech-to-text stays as an alternative behind the same interface | Cheaper and faster; budget per user still open (question 2) |
| iOS share sheet | Apple Shortcut "Send to Scraps" posting to a token-authenticated capture endpoint | iOS Safari does not support the Web Share Target API (WebKit bug 194593 still open in 2026). Native share extension comes with the native app |
| Monitoring | Sentry (errors) in Phase 9 | Analytics left out of v1 unless the owner asks |
| Testing | Vitest, Testing Library, Playwright, Supabase SQL tests | Two-context Playwright tests cover co-editing |

## Product defaults chosen in the spec (change any of these before the relevant phase)

1. **Theme "auto"** follows the device's light/dark setting. The header toggle sets an explicit choice; settings offer "auto" again. Night copy (greetings, empty states) shows whenever the after midnight theme is on.
2. **AI suggestions are off by default** (confirmed Oct 2026). A one-time opt-in prompt on first capture explains what is sent; a settings toggle controls it afterwards. Only the scrap's own text, its link title and the user's space and tag names are sent; no images, no audio.
3. **Roles per space:** owner, editor, viewer. Sharing is per space, not per note, in v1. A note shares by moving it to a shared space.
4. **Streak** counts consecutive local days on which the user created or edited at least one scrap.
5. **Board order:** pinned first, then most recently edited. No manual drag ordering in v1.
6. **Limits:** images up to 15 MB before resize, voice memos up to 5 minutes, 10 members per space in v1.
7. **Deleting** moves notes to a 30-day trash per space; owners can restore or empty it.

## Open questions for the owner

1. Final product name and domain (the kit uses "scraps." throughout).
2. ~~Transcription provider~~ Groq Whisper confirmed. Still open: budget per user per month.
3. ~~AI default~~ Off until opt-in, confirmed.
4. Is a free tier with limits planned? This affects storage quotas in Phase 9.
5. Any languages besides English for UI copy and transcription in v1?

## Decisions made during build

Claude Code appends entries here as `YYYY-MM-DD, phase N: decision, reason`.

- 2026-10-10, plan review: **single collab instance for v1.** Hocuspocus keeps live docs in memory per instance, so multiple instances behind sticky sessions can split one note across servers and lose edits. One instance covers the 1,000 connection target. Scaling out needs the Hocuspocus Redis extension (or routing by note id) and is deferred.
- 2026-10-10, plan review: **`notes.meta_updated_at`** is the only clock used for offline metadata last-write-wins. `updated_at` is bumped by content stores and is board-ordering only. Reason: otherwise an unrelated content edit makes an older offline pin or colour change lose.
- 2026-10-10, plan review: **media keyed by note id** (`media/{note_id}/{asset_id}`), storage RLS resolves the note's current space. Reason: moving a note (including accepting an AI suggestion) must not orphan or re-permission media.
- 2026-10-10, plan review: **`transcript_tsv` is a separate column** maintained by an `assets` trigger; the extractor owns `search_text`. Reason: two writers on one column would drop transcripts on the next edit.
- 2026-10-10, plan review: **dedicated `title` node** as the first node of every document. Reason: one source of truth for editor, cards, search and offline create; avoids heading-versus-first-line ambiguity.
- 2026-10-10, plan review: **AI off by default, age gate 16+, STT vendor disclosed.** Reason: users include 17 year olds and audio leaves the platform.
- 2026-10-10, plan review: **no server-side image conversion in Edge Functions.** The iOS Shortcut sends JPEG (it can convert), `capture` stores it as-is with EXIF stripped by a tiny JPEG segment filter, and the browser path does WebP conversion as in SPEC 9.3. HEIC that cannot be converted in the browser is rejected with a clear message in v1.
- 2026-10-10, phase 0: **Serwist via `@serwist/turbopack`**, not `@serwist/next`. A route handler (`app/serwist/[path]/route.ts`) bundles `src/app/sw.ts` with esbuild, so Turbopack stays the bundler for dev and production and the webpack fallback in the stack table is not needed. Verified: production build, the SW registers at scope `/` and controls the page (`e2e/sw-spike.spec.ts`). Needs `esbuild` as a direct dependency and `serverExternalPackages: ["esbuild"]`.
- 2026-10-10, phase 0: **Local Supabase works** with the `supabase` CLI 2.120 as a devDependency (`pnpm db:start`), Postgres 17. The mail catcher is Mailpit on :54324, not Inbucket; Phase 1 tests should use that. Docker Desktop must be running.
- 2026-10-10, phase 0: **Completed checklist rows use 65% opacity, not 55%** (SPEC 3.7), class `.sc-done`. Measured on lime: 60% gives 4.46:1 (fails AA), 65% gives about 5.2:1. The strike-through carries the state as well.
- 2026-10-10, phase 0: **Sticker outlines use `--line`** (ink by day, off-white at night); details inside coloured fills use `--on-accent`. With `--on-accent` everywhere, free-floating strokes (planet ring, zzz) vanished on the dark theme.
- 2026-10-10, phase 0: **`packages/ui` styles are plain CSS classes** (`sc-*` in `styles.css`) that read only token variables; Tailwind utilities are used for page layout in `apps/web`. Keeps the design system independent of Tailwind scanning and makes the no-hex rule a simple grep test.
- 2026-10-10, phase 0: **Dialog and Sheet use the native `<dialog>`** with `showModal()` for focus trap, scrim, Escape and focus return, instead of a hand-rolled trap.
- 2026-10-10, phase 0: **Theme resolution.** The server renders `data-theme` from the cookie (`day` for `auto`); an inline head script resolves `auto` from `prefers-color-scheme` before first paint. `ThemeProvider` takes `onThemeChange` so Phase 1 can persist to `profiles.theme`.
- 2026-10-10, phase 0: **Toolchain pins.** TypeScript 5.9 (not 7) and ESLint 9 (not 10) because the lint plugins and Next tooling peer ranges target them. `lucide-react` ^1.50 and `prettier` ^3.9.9 because the newest releases were under a day old and pnpm 11's minimum release age flagged them. pnpm 11 uses `allowBuilds` in `pnpm-workspace.yaml` for install scripts (`@swc/core`, `esbuild`, `supabase`).
- 2026-10-10, phase 0: **No `motion` dependency yet.** Phase 0 animation is CSS only; add `motion` in Phase 9 if it is needed.
- 2026-10-10, phase 0: **Playwright's iPhone 14 project runs on Chromium** (viewport, touch and user agent from the device profile) so one browser install covers both projects. WebKit is not exercised until real-device testing in Phase 9.
- 2026-10-10, phase 1: **Next 16 `proxy.ts`** (the renamed middleware) refreshes the Supabase session and redirects signed-out visitors. It is an optimistic check only; every page and action re-validates with `auth.getUser()`. It skips the network call when there is no `sb-*` cookie.
- 2026-10-10, phase 1: **Magic links carry a `token_hash` and land on `/auth/confirm`**, via a custom `magic_link` email template (`supabase/templates/magic-link.html`). Unlike PKCE they work on any device or browser. `/auth/callback` (PKCE code) exists for Google. The template points at `site_url`, which is `http://localhost:3000` locally and must be the production origin in the hosted project.
- 2026-10-10, phase 1: **`profiles` is readable by people who share a space**, not only by its owner (SPEC 11.3 said owner only). Presence avatars, carets and member lists in Phase 5 need it, and it exposes only display name and avatar sticker. Helper: `shares_space()`.
- 2026-10-10, phase 1: **Two extra `profiles` columns:** `birth_year` (age gate) and `onboarded_at` (onboarding finished). The gate needs a 17 year gap because only the year is collected, which guarantees everyone passing is at least 16. Under 16: the action signs out and redirects to `/sign-in?error=underage`.
- 2026-10-10, phase 1: **Metadata last-write-wins lives in the database** (`notes_meta_lww` trigger on `meta_updated_at`), so a replayed or stale outbox write cannot overwrite newer metadata whichever client sends it. Content stores leave the clock alone.
- 2026-10-10, phase 1: **`assets.space_id` is set by trigger from the note and follows note moves**; `notes.transcript_tsv` is maintained by a trigger on `assets`. Both were pulled forward from later phases because the plan-review decisions needed them in the schema.
- 2026-10-10, phase 1: **Storage policies resolve the space from the note id** in the first path segment (`media_note_role`). Bucket limit is 20 MiB per object, above the 15 MiB pre-resize cap in the product defaults. Non-uuid first segments are rejected.
- 2026-10-10, phase 1: **`listSpaces` filters on the user id.** The members policy lets you read your co-members' rows, so an unfiltered query returned shared spaces once per member. Caught by the e2e suite.
- 2026-10-10, phase 1: **Mutations are server actions validated with zod** (`createSpace`, `updateSpace`, `updateProfile`, `completeOnboarding`, `saveTheme`) and run as the signed-in user, so RLS is the authority. A non-owner rename returns "only the owner can change this space" because RLS filters the update to zero rows.
- 2026-10-10, phase 1: **Theme persistence:** `AppThemeProvider` calls the `saveTheme` action on every change; `/auth/confirm` and `/auth/callback` set the `scraps-theme` cookie from `profiles.theme`, so a browser with no cookie still gets the saved theme after signing in.
- 2026-10-10, phase 1: **Google provider is declared but disabled** in `supabase/config.toml` (needs `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`). The sign-in action asks `/auth/v1/settings` whether it is enabled and shows a friendly message instead of a raw provider error.
- 2026-10-10, phase 1: **Desktop sub pages carry the header toggle** through `PageHeading`, because there is no top bar at 1024px and up. Below that the top bar has it.
- 2026-10-10, phase 1: **Open follow-up for Phase 9:** an under-16 sign-up leaves a bare `auth.users` row (email only) because deleting auth users needs the service role, which `apps/web` never holds. The account-deletion work should include a scheduled purge of un-onboarded accounts.
- 2026-10-10, phase 2: **Collab verifies user tokens against the project's JWKS** (`/auth/v1/.well-known/jwks.json`) with the algorithm pinned. Local and hosted Supabase sign access tokens with **ES256**, so the HS256 `SUPABASE_JWT_SECRET` the kit listed is only an optional fallback for legacy projects. Verified end to end against the local stack.
- 2026-10-10, phase 2: **Hocuspocus `Server` with an `onRequest` hook** serves `/health` and `POST /notes` on the same port as the WebSocket. Shutdown is `server.destroy()`, which flushes every pending debounced store. Store is debounced 2 s, max 10 s (SPEC 9.2), and the last disconnect stores immediately.
- 2026-10-10, phase 2: **One transaction per store** (`store_note` RPC): the Yjs state, card fields, `search_text` and the streak day (in the user's `profiles.timezone`, UTC if the name is invalid). `note_access` and `space_access` give the server a one-call role check. All three are service role only.
- 2026-10-10, phase 2: **Metadata last-write-wins is per field**, not per row (migration `20261010140000`). The Phase 1 row-level clock dropped the older of two writes to different fields when they arrived out of order (colour then pin). `notes.meta_clock` holds one timestamp per field; `meta_updated_at` is the latest accepted write. Caught by the e2e suite.
- 2026-10-10, phase 2: **The editor mounts after the first sync.** Binding to an empty Yjs fragment made the editor write a default paragraph that then merged with the stored one, so every note opened with a stray block. `useNoteSession` exposes `synced`; Phase 6 will gate on y-indexeddb the same way.
- 2026-10-10, phase 2: **StarterKit's trailing-node plugin is off** for the same reason. The editor adds a trailing paragraph on demand when you click the space under the last block.
- 2026-10-10, phase 2: **Title Enter and Backspace are handled at priority 1000** (`TitleGuard`) so the core keymap never splits the title or merges the first block into it.
- 2026-10-10, phase 2: **Two `@scraps/editor` entries.** `@scraps/editor` is server-safe (schema, preview extractor, initial documents, Yjs helpers) and tested with no DOM. `@scraps/editor/react` has the editor, node views and slash menu. Only `taskItem` (checkbox) and `callout` (colour picker) have React node views; big text, table and code are styled with CSS.
- 2026-10-10, phase 2: **`props` column on `notes`** (jsonb: `vibe`, `when`) holds the property chips from SPEC 6.3; tags use `tags` / `note_tags`. All metadata writes from the browser go through PostgREST under RLS with a client `meta_updated_at`.
- 2026-10-10, phase 2: **Offline chip copy.** While offline the sync chip says "reconnecting…" rather than the spec's "offline · saved on this device", because nothing is persisted locally until y-indexeddb arrives in Phase 6. Swap to the spec copy then.
- 2026-10-10, phase 2: **"new scrap" and the tab bar "+" start a blank scrap directly** (`POST /notes`, then open it). Phase 3 replaces both with the capture sheet. The board is a plain list until then.
- 2026-10-10, phase 2: **`apps/collab` builds with esbuild** (one bundled file, `node build.mjs`). `tsc` cannot emit it because the workspace packages are TypeScript source, and pnpm's strict `node_modules` would stop a partially bundled file from finding their dependencies at runtime.
- 2026-10-10, phase 2: **Test layers.** `pnpm check` runs the fast collab suite with a fake store (23 tests). `pnpm test:int` runs the Supabase-backed suite (real tokens, store, search, streak); CI runs both.
- 2026-10-10, phase 3: **New runtime dependency `@tanstack/react-query`** (already in the confirmed stack): board pages, kind counts, search and streak are queries; Phase 6 adds IndexedDB persistence.
- 2026-10-10, phase 3: **`notes.search_plain`** keeps the extractor's plain search string next to `search_text` because `ts_headline` needs text, not a tsvector. `search_notes` uses `websearch_to_tsquery` in `english` and `simple`, plus a trigram match on title, and returns snippets with `<<` `>>` markers.
- 2026-10-10, phase 3: **Streak is `current_streak()`**, a security-invoker SQL function, not a view, because it needs `auth.uid()` and the profile timezone. A streak is alive if there is activity today or yesterday.
- 2026-10-10, phase 3: **Checklist toggle** is `POST /notes/:id/checklist {index, checked, text?}`. `index` counts task items in document order (what the card preview lists); `text` guards a stale card (409). It applies the change through a Hocuspocus direct connection, so open editors update live and the normal store path updates the preview.
- 2026-10-10, phase 3: **Capture text rule:** first line is the title, the rest the body. List type: first line is the title and each later line an item; one line is a single item with no title. Lists start lime and quotes pink (set by the collab server on create, SPEC 8.4); the user can recolour.
- 2026-10-10, phase 3: **Paging** is offset based (40 per page, pinned then `updated_at`, `id` as tiebreak). A scrap edited between page loads can shift by one; acceptable for a board.
- 2026-10-10, phase 3: **Phone search** is the same palette as a full-screen overlay, not a separate route. The sidebar and the phone header search field both open it; the clipboard row in capture reads the clipboard only on tap and appends whatever text it finds (the link block arrives in Phase 4).
- 2026-10-10, phase 3: **Starter scraps are created client side** after onboarding saves, through `createNote()` (the function Phase 6 will route via the outbox). The onboarding action no longer revalidates or redirects: doing so unmounted the form before it could create them. Mood board starter waits for Phase 4.
- 2026-10-10, phase 3: **Card titles are `h2`** under the page `h1` (axe heading order). The card is one link target (title link stretched over the card) with the checkboxes and menu button layered above it.
