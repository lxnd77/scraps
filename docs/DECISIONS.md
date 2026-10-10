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
