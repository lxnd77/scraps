# Phase 3: Board, cards and quick capture

**Goal:** the board looks and behaves like the design: real cards per kind, filters, tilt, pinning, search, the quick capture sheet and the streak.

**Depends on:** Phase 2. **Read:** SPEC 6.1, 6.2, 6.4, 6.9, 6.11, 8.4, 9.7, 9.8; artboards `Main`, `Phone-Home`, `Phone-Capture` and their midnight versions.

## Tasks

- [x] **3.1 Notes query.** Server-side paginated query per space (pinned first, then `updated_at` desc, 40 per page) with a filter by kind; TanStack Query on the client with infinite scroll.
- [x] **3.2 Card components.** `NoteCard` variants from SPEC 8.4 for text, list and quote now; pic, link and voice render a neutral fallback until Phase 4. Colour prop maps to fill and the theme's `--card-shadow-*`. Tilt from note id; tidy mode removes it.
- [x] **3.3 Live checklist on cards.** Toggling a checkbox on a list card calls the collab server `POST /notes/:id/checklist` (add it now) which applies the change to the Y doc; optimistic UI with rollback on failure.
- [x] **3.4 Board layout.** Desktop masonry (CSS columns), tablet 2 columns, phone 2-column stack per the phone artboard. "Switch layout" toggles compact list view, remembered per device.
- [x] **3.5 Filter chips.** everything, notes, lists, pics, links, voice with counts from a grouped count query; active chip style per SPEC 6.1.
- [x] **3.6 Card actions.** Card context menu (right click / long press): pin, colour, move to space, delete. Keyboard: arrows move focus between cards, Enter opens, `P` pins.
- [x] **3.7 Quick capture sheet.** SPEC 6.4: opened from "new scrap", phone "+", and key `N`. Textarea, type tiles (text and list functional now; pic, link, voice and sticker tiles open their Phase 4 flows, show "coming soon" until then), clipboard "paste" row (reads clipboard only on tap), space picker, "save it". Saving calls `POST /notes` with the starting block and closes the sheet; the new card pops in at the top.
- [x] **3.8 Search.** `search_text` maintained by the collab server's extractor; Postgres FTS + trigram; ⌘K palette with grouped results and highlighted snippet; phone full-screen search.
- [x] **3.9 Streak.** View over `note_activity` respecting `profiles.timezone`; sidebar streak card and copy (day/night variants).
- [x] **3.10 Greetings.** Time-of-day greeting logic and night copy (SPEC 4.2) on desktop and phone headers.
- [x] **3.11 States.** Empty board, skeleton loading, not-found, error callouts.
- [x] **3.12 Starter scraps.** Onboarding now creates three starter scraps (welcome note, sample checklist, sample quote) through `POST /notes`. The mood board starter from SPEC 6.6 is added in Phase 4 once the block exists. Create them through the same client function Phase 6 will route via the outbox, so offline onboarding works later.

## Acceptance criteria
- [ ] With the seed data, the desktop and phone boards match the artboards in both themes (allowing for Phase 4 kinds). *Not checked by eye against the artboards; no demo seed yet.*
- [x] Ticking a checklist item on a card updates the open editor of the same note within a second and persists.
- [x] Capture to saved card in 2 taps on phone; `N` then Enter-to-save on desktop (Cmd/Ctrl+Enter saves).
- [x] Search finds a word inside a checklist item and highlights it; returns under 300 ms on 5,000 seeded notes locally.
- [x] Streak increments on the first scrap of a new local day.

## Tests (minimum)
- Unit: card variant picks the right component for each `kind`; greeting picks the right string by hour and theme.
- E2E: capture a text scrap and a list scrap; filter to lists; pin a card and see it move to the top; search and open a result; keyboard navigation across cards.
- Perf: seed 5,000 notes script and a search timing check.

## Out of scope
Media kinds (Phase 4), shared spaces (Phase 5), offline (Phase 6).
