# Phase 6: Offline and PWA

**Goal:** Scraps installs like an app and keeps working with no connection. Everything typed offline syncs later with no duplicates and no lost words.

**Depends on:** Phase 5. **Read:** SPEC 10, 6.11 (offline state), DECISIONS (Serwist note from the Phase 0 spike).

## Tasks

- [x] **6.1 Manifest.** Name, short name, icons (maskable, both themes considered), `theme_color`/`background_color` matching the daylight bg, `display: standalone`, shortcuts ("new scrap"). `share_target` is added in Phase 7.
- [x] **6.2 Service worker.** Serwist: precache app shell, fonts, sticker SVGs, offline fallback route; runtime cache for media by asset id (custom cache key, since signed URLs change); network-first for API routes with a short timeout.
- [x] **6.3 Install UX.** Custom "add scraps to your home screen" prompt on Android/desktop (`beforeinstallprompt`), and a short how-to sheet for iOS Safari (Share → Add to Home Screen). Show once, dismissible, re-offer from settings.
- [x] **6.4 Note content offline.** `y-indexeddb` persistence per opened note; editor loads from IndexedDB first, then connects; prefetch the 50 most recently opened notes when online (open a provider briefly, then close).
- [x] **6.5 Query persistence.** Persist TanStack Query cache (spaces, notes lists, profile) to IndexedDB with a cache buster on schema version.
- [x] **6.6 Outbox.** IndexedDB outbox for: create note (via collab `POST /notes`, idempotent on id), metadata updates (colour, pin, tags, move, delete), checklist toggles from cards (apply in the local Y doc if the note is cached; if the note was never opened on this device, disable the toggle offline with a "open this scrap once online first" hint). Replay in order on reconnect with exponential backoff; last-write-wins on metadata by `meta_updated_at` (never `updated_at`).
- [x] **6.7 Offline uploads.** Image and audio blobs stored in IndexedDB with their asset ids; blocks render local object URLs; upload on reconnect, then swap to signed URLs.
- [x] **6.8 Sync status.** Global sync store feeding `SyncChip` states (saved, syncing, offline, error) and the first-offline banner; unsynced-changes warning after 24 hours; `navigator.storage.persist()` after sign-in.
- [x] **6.9 Offline search.** Search the cached notes list by title and preview when offline; show "searching this device only".

## Acceptance criteria
- [ ] Installed on Android Chrome and desktop Chrome; Lighthouse PWA installability passes. *Chromium's installability check (CDP `Page.getInstallabilityErrors`) returns no errors in the production build; not installed on a real Android phone and Lighthouse was not run.*
- [x] With the network off: open a previously opened note, edit it, create two new scraps (one with an image), toggle a card checklist; turn the network on and everything appears on another device, no duplicates.
- [x] Two users edit the same paragraph while one is offline; after reconnect both edits are present.
- [x] Hard reload while offline shows the board from cache, not an error page.

## Tests (minimum)
- Unit: outbox ordering, idempotent replay, backoff.
- E2E: Playwright `context.setOffline(true)` scenarios from the acceptance list; service worker registered in production build test.

## Out of scope
Background sync on iOS (not supported); conflict UI for metadata (last write wins is accepted).
