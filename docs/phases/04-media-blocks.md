# Phase 4: Rich media blocks

**Goal:** images, mood boards, link embeds, voice memos, stickers, covers and page icons work in the editor, on cards and in quick capture.

**Depends on:** Phase 3. **Read:** SPEC 3.6, 6.3 (cover, icon, right rail), 6.4, 8.2 (media rows), 8.4, 9.3, 9.4 (recording, playback; transcription comes in Phase 8), 11.4 (`unfurl-link`), 12.

## Tasks

- [ ] **4.1 Upload pipeline.** Client util: validate type and size, convert/resize images to WebP (max 2048px, quality 0.82, strip EXIF GPS), compute dominant colour, upload to `media/{space}/{note}/{asset}.webp`, insert `assets` row. Signed URL hook with in-memory cache and refresh before expiry.
- [ ] **4.2 Image block.** Drop, paste and `/img`; caption; polaroid frame option; alt text field; loading state with dominant-colour box.
- [ ] **4.3 Mood board block.** 2 to 9 images in a responsive grid of polaroids with captions and alternating tilt; add/remove/reorder images.
- [ ] **4.4 `unfurl-link` Edge Function.** SSRF-safe fetch exactly as SPEC 11.4; Open Graph and oEmbed (YouTube duration, maps pin); cache in `link_previews`. Unit-test the IP blocking with private, loopback, link-local, IPv6 and DNS-rebinding style cases.
- [ ] **4.5 Link embed block.** Paste a URL on an empty line offers "embed" (default) or "keep as link"; card shows thumbnail or icon tile, domain, title, description, duration. Images from third-party hosts go through a Next.js image proxy route with an allow-list built from `link_previews`.
- [ ] **4.6 Voice memo block.** Record with MediaRecorder (format by browser), 5-minute cap, timer, live waveform peaks; upload as an `audio` asset with `transcript_status = 'none'` for now; playback with waveform progress, scrubbing, duration and author.
- [ ] **4.7 Stickers.** Inline sticker block via `:` and the sticker drawer (click inserts at cursor, drag onto the page); page icon picker; sticker overlapping card corners on quote cards.
- [ ] **4.8 Covers.** Pattern covers (two-accent stripes), night illustration cover, uploaded image cover; "change cover" picker; page outfit swatches change the page accent (cover stripe colour, highlight colour).
- [ ] **4.9 Card kinds.** Pic (polaroid with tape, "+N pics"), link (media header, play badge, domain), voice (play button, waveform, duration) on the board, desktop and phone. Card voice play button plays inline without opening the note.
- [ ] **4.10 Quick capture types.** pic tile opens camera/file picker and creates an image-led scrap; link tile shows a URL field (and the clipboard row); voice tile shows a record button; sticker tile shows the pack.
- [ ] **4.11 Right rail.** Sticker drawer, page outfit, activity box on desktop editor; collapses below the page under 1100px.

## Acceptance criteria
- [ ] Every block in SPEC 8.2 can be inserted from the slash menu and renders in both themes.
- [ ] A 12 MB iPhone photo uploads as a WebP under 1 MB with no GPS EXIF.
- [ ] Unfurling `http://169.254.169.254/` or a hostname resolving to `10.0.0.1` is refused.
- [ ] Recording a 30-second memo on iOS Safari and desktop Chrome both play back on the other.
- [ ] Seeded board matches all six card kinds in the artboards.

## Tests (minimum)
- Unit: image resize util; SSRF guard; waveform peak computation; kind derivation for image, link and voice led docs.
- E2E: insert image by drag-drop, link by paste, sticker via `:`; record a voice memo with a fake media stream (Playwright `--use-fake-device-for-media-stream`); capture a link scrap from the sheet.

## Out of scope
Transcription and AI (Phase 8); offline upload queue (Phase 6).
