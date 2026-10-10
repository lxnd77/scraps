# Phase 7: Share-sheet capture

**Goal:** send links, text and photos into Scraps from other apps. Native share target on Android and desktop; an Apple Shortcut with a capture token on iOS.

**Depends on:** Phase 6. **Read:** SPEC 6.7 (capture section), 9.6, 12.

## Tasks

- [ ] **7.1 Share target.** Add `share_target` to the manifest (`POST`, `multipart/form-data`, params `title`, `text`, `url`, files `image/*` and `audio/*`).
- [ ] **7.2 SW handler.** Service worker intercepts `POST /share-target`, stores fields and files in IndexedDB under a share id, responds with a redirect to `/?capture=<shareId>`. Works offline.
- [ ] **7.3 Prefilled capture.** Capture sheet reads the share payload: URL → link scrap (with unfurl when online), images → pic scrap (1 image) or mood board (2+), text → text scrap; picks the default capture space; user can edit before saving. Clear the payload after save or cancel.
- [ ] **7.4 Desktop drop.** Drag files or URLs onto the desktop board to open the capture sheet prefilled.
- [ ] **7.5 Capture tokens.** Settings → capture: create token (label, shown once with copy button), list tokens with last used time, revoke.
- [ ] **7.6 `capture` Edge Function.** Bearer token auth (hash compare, constant time), rate limit 30/min per token, accepts JSON `{ url?, text?, title? }` or multipart with one image; uploads the image as an asset (JPEG/PNG stored as-is with EXIF stripped; no server-side WebP or HEIC conversion in v1, see DECISIONS); creates the note via collab `POST /notes` (internal secret) in the user's default capture space; returns `{ noteId, url }`.
- [ ] **7.7 Apple Shortcut.** Build and document the "Send to Scraps" shortcut (share-sheet input: URLs, text, images; asks for the token on install; posts to the capture function; shows "saved to scraps" notification). Ship a hosted `.shortcut` file link plus step-by-step in-app instructions with screenshots in settings.
- [ ] **7.8 Hand-off.** Captured scraps from the shortcut appear at the top of the board via Realtime and trigger AI suggestions once Phase 8 lands (leave a hook).

## Acceptance criteria
- [ ] On Android with the PWA installed, sharing a YouTube link from the YouTube app opens the capture sheet with a link scrap ready; saving creates the card.
- [ ] Sharing three photos from the gallery creates a mood board scrap.
- [ ] Sharing while offline queues the scrap and it syncs later.
- [ ] On iOS, the shortcut saves a Safari page and a photo into brain dump; a revoked token gets a 401.

## Tests (minimum)
- Unit: share payload parser; capture function auth, rate limit and validation.
- E2E: simulate a share-target POST against the production SW build; call the capture function with a valid and a revoked token.

## Out of scope
Native iOS share extension (native app phase); email-in.
