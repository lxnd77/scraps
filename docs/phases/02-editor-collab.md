# Phase 2: Editor core and collab server

**Goal:** a note opens in a Tiptap block editor whose content lives in a Yjs document synced through Hocuspocus and stored in Postgres. Single user for now, but the plumbing is the real multiplayer plumbing.

**Depends on:** Phase 1. **Read:** SPEC 6.3, 6.5, 8.1, 8.2 (text blocks), 8.3, 9.2 (auth and persistence parts), 11.5.

## Tasks

- [ ] **2.1 Shared schema (`packages/editor`).** Tiptap extensions list exported as `scrapsExtensions(options)` used by both the browser editor and the server transformer. Include: document (first child is always the `title` node), title, paragraph, text, headings 1 to 3, bold, italic, strike, code, highlight (yellow pill), link, bullet list, ordered list, checklist (task list + task item with optional `assigneeId`, `due`), callout (colour + sticker attrs), big text, divider, code block, table, unique block ids, placeholder.
- [ ] **2.2 Node views.** React node views styled to the artboards: checklist rows (custom `Checkbox`, strike-through on done), callout card, big text, table, code. Block gutter with "+" and drag handle (Tiptap drag handle extension, MIT) visible on hover and on the focused block.
- [ ] **2.3 Slash menu.** "/" opens the "drop a block" menu with icon tiles, names, one-line descriptions and shortcut hints (SPEC 6.3). Keyboard: arrows, Enter, Esc, type-to-filter. Markdown input rules from SPEC 8.2.
- [ ] **2.4 Collab server.** `apps/collab` with Hocuspocus 4: `onAuthenticate` verifies the Supabase JWT and the user's role on the note's space (reject if none); database extension `fetch` and `store` against `note_docs` using the service role; debounced store (2 s, max 10 s) and flush on last disconnect; health route; graceful shutdown.
- [ ] **2.5 Preview extraction.** On store: transform Y doc to JSON with the shared extensions, derive `title`, `preview_text`, `kind`, `word_count`, `preview` (SPEC 8.3) and update `notes` plus `updated_at`, `last_edited_by`, `note_activity`. Unit-test the extractor on fixture docs for every kind.
- [ ] **2.6 Create note endpoint.** `POST /notes` on the collab server (JWT auth): creates the `notes` row with a client-supplied UUID and an initial block (`text`, `checklist`, etc.), returns the id. Idempotent on id.
- [ ] **2.7 Editor page.** Route `/n/[noteId]`: top bar (breadcrumb, `ThemeToggle`, `SyncChip` wired to provider status, share button disabled until Phase 5), title is the dedicated `title` node from SPEC 8.1 (decided, see DECISIONS), property chips row (tags and date, stored in `notes` metadata and `note_tags`), blocks. Phone layout per SPEC 6.5 including the floating block toolbar.
- [ ] **2.8 Note metadata.** Colour, pin and delete (soft) from the "more" menu, through PostgREST under RLS.
- [ ] **2.9 Temporary list.** A plain list of notes in the current space on the board route (title + edited time) so notes can be created and reopened; Phase 3 replaces it with cards.

## Acceptance criteria
- [ ] Creating a note, typing, adding a checklist and a callout, then reloading shows the same content; `note_docs` has a row and `notes.preview` reflects the content.
- [ ] A user without membership gets a refused connection and a "this scrap isn't yours to see" page.
- [ ] Slash menu inserts every text block type; markdown shortcuts work.
- [ ] The editor works with keyboard only (create blocks, toggle checklist items, move between blocks).
- [ ] Both themes and both layouts match the editor artboards for the text blocks.

## Tests (minimum)
- Unit: preview extractor fixtures (text, list, quote, mixed); schema round-trip test (JSON to Y doc to JSON is lossless for every node).
- Integration: collab server auth rejects bad JWT and non-members; store writes `note_docs` and `notes` preview.
- E2E: create note, type, add checklist, reload, content intact.

## Out of scope
Images, links, voice, stickers (Phase 4); multi-user presence (Phase 5); offline persistence (Phase 6).
