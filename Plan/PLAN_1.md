# Build plan

Ten phases, each a shippable slice that ends with green tests and a demo. Work them in order; each phase file lists what it depends on.

| # | Phase | Outcome you can demo | Spec sections |
|---|---|---|---|
| 0 | [Foundations and design system](phases/00-foundations.md) | Monorepo runs, CI green, `/styleguide` shows every component in daylight and after midnight with the header toggle | 3, 4.1, 7, 13 |
| 1 | [Auth, spaces and app shell](phases/01-auth-spaces-shell.md) | Sign in with magic link or Google, onboarding creates "brain dump", sidebar and phone tab bar navigate between spaces | 5, 6.6, 6.7 (theme part), 9.1 (data only), 11.2, 11.3 |
| 2 | [Editor core and collab server](phases/02-editor-collab.md) | Create a note, write with text blocks, checklists, callouts, headings and slash menu; content saves through Hocuspocus and survives reload | 6.3, 8.1, 8.2 (text blocks), 8.3, 11.5 |
| 3 | [Board, cards and quick capture](phases/03-board-capture.md) | Board shows real cards per kind with filters, tilt, pinning and search; quick capture sheet creates scraps; streak works | 6.1, 6.2, 6.4, 6.9, 6.11, 8.4, 9.7, 9.8 |
| 4 | [Rich media blocks](phases/04-media-blocks.md) | Images, mood boards, link embeds, voice memos (record and play), stickers, covers and page icons | 6.3, 8.2 (media), 9.3, 9.4 (recording), 11.4 (`unfurl-link`) |
| 5 | [Live co-editing and sharing](phases/05-collab-sharing.md) | Two people edit one page live with avatars and carets; invite links; viewer read-only | 6.8, 9.1, 9.2 |
| 6 | [Offline and PWA](phases/06-offline-pwa.md) | Installable app; airplane mode keeps board and notes working; offline scraps sync with no duplicates | 10, 6.11 |
| 7 | [Share-sheet capture](phases/07-share-capture.md) | Share a link or photo from Android/desktop into Scraps; iOS Shortcut does the same with a capture token | 9.6, 6.7 (capture), 12 |
| 8 | [AI: transcription and auto-sort](phases/08-ai.md) | Voice memos get transcripts; captured scraps get "file under..." suggestions you accept or dismiss | 9.4 (transcription), 9.5, 12 |
| 9 | [Polish, hardening and launch](phases/09-polish-launch.md) | Motion, a11y and performance audits pass; export and trash; monitoring; production deploy | 3.7, 6.10, 9.9, 13, 14 |
| later | [Native app](phases/10-later-native.md) | Not v1. Notes for the Expo app, iOS share extension and widgets | 15 |

## Ground rules for every phase
- Start by reading `CLAUDE.md`, `docs/PROGRESS.md`, the phase file and the listed spec sections.
- Both themes and phone plus desktop layouts are part of "done" for any UI task.
- Each phase ends with: acceptance criteria ticked, `pnpm check` and `pnpm e2e` green, `docs/PROGRESS.md` updated, a short summary of decisions made and anything deferred.
- Seed data (`supabase/seed.sql`) grows with each phase so demos look like the design reference.

## Risk register

| Risk | Phase | Mitigation |
|---|---|---|
| Serwist and the installed Next.js build tooling disagree | 6 | Spike in Phase 0 (task 0.9): build a hello-world SW and confirm it registers in production build |
| Yjs preview extraction drifts from client schema | 2 | Single schema package `packages/editor` imported by both apps; contract test that round-trips every block |
| iOS storage eviction loses offline edits | 6 | `storage.persist()`, installed PWA guidance, unsynced-changes warning after 24 h |
| Collab server becomes a single point of failure | 5 | Health checks, autosave on disconnect, clients keep editing locally (y-indexeddb) while it reconnects |
| AI cost spikes | 8 | Haiku model, 2,000-char cap, per-user rate limit, suggestions only on capture or on demand |
| Transcription provider choice | 8 | `TranscriptionProvider` interface with a fake provider for tests; owner confirms vendor before Phase 8 |
