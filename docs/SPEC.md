# scraps. product and design spec (v1)

Version 1.0, October 2026. Design source: the "Gen-Z Notes App" canvas (10 artboards, copied into `docs/design-reference/`). Where this spec and the artboards disagree, this spec wins; where the spec is silent, match the artboards.

---

## 1. Product in one page

**What it is.** A notes app for people who think in fragments. Every note ("scrap") is a block page like Notion, but on the board it shows up as a loud, slightly tilted card with its own colour and personality. Scraps can be text, checklists, images, links, voice memos and stickers, mixed freely inside one page.

**Who it is for.** 17 to 27 year olds who currently scatter thoughts across Notes, WhatsApp-to-self, screenshots and Pinterest. They want capture to be instant and the result to look like theirs.

**v1 promise.**
1. Capture anything in under 3 seconds from the board, the phone, or another app's share sheet.
2. Open any scrap into a full block editor with checklists, images, links, voice memos, stickers, tables and callouts.
3. Share a space with friends and edit the same page live, with faces and carets.
4. Keep working offline; everything syncs when the signal comes back.
5. Let AI suggest where a scrap belongs and what to tag it, without ever moving things on its own.
6. Two themes, daylight and after midnight, switched from a sun/moon toggle in the header.

**Design principles**
- **Loud, not messy.** Bold colour and tilt, but strict alignment, consistent outlines and generous spacing underneath.
- **Every note gets an outfit.** Colour, sticker and cover are first-class, never buried in settings.
- **Capture first, organise later.** Nothing blocks saving. Sorting is a suggestion.
- **Feels like a group chat, works like a doc.** Casual copy, serious reliability (no lost words, ever).

---

## 2. Core jobs and success measures

| Job | Done when |
|---|---|
| Dump a thought fast | New scrap saved from any screen in 2 taps or one keyboard shortcut (`N`) |
| Find it later | Search returns matches across titles, text, checklist items and voice transcripts in under 300 ms for 5,000 notes |
| Plan with friends | Two people edit one page at once and see each other's changes in under 500 ms on a normal connection |
| Use it on the train | Notes opened before stay readable and editable offline; new scraps created offline sync on reconnect with no duplicates |
| Make it theirs | Card colour, sticker icon and cover change in one tap each |

---

## 3. Visual design system

Tokens live in `docs/tokens.css`. This section explains how to use them.

### 3.1 Personality
Neo-brutalist sticker-book: thick outlines, hard offset shadows, saturated flat colour, slight rotation, washi-tape and polaroid motifs, chunky grotesque type with a monospace "label maker" accent.

### 3.2 Colour
- Six accents shared by both themes: yellow `#FFD60A`, lime `#A6F000`, pink `#FF3EA5`, blue `#2340FF`, lilac `#9F7BFF`, orange `#FF6A00`.
- **Daylight**: lilac paper background `#EDE7FF`, white surfaces, ink `#111` for text, outlines and every shadow.
- **After midnight**: ink-violet background `#0B0820`, surfaces `#17112E` / `#221A40`, off-white `#F4F0FF` text and outlines. Shadows become neon: each card colour has a partner shadow (`--card-shadow-*`). Structural dividers drop to a quiet `#2E2552` so only components glow.
- Text on accent fills always uses `--on-accent` (near black); text on blue uses `--on-blue`. Never put white text on yellow, lime, lilac, pink or orange.
- Default card colour by kind: text yellow, list lime, pic surface (polaroid), link blue, voice lilac, quote pink. The user can recolour any card (7 options: the six accents plus surface).
- Space colours use the same six accents.

### 3.3 Typography
- Display and UI: **Bricolage Grotesque** (variable, 400 to 800). Headlines 800 with negative tracking (see `--text-*` comments in tokens).
- Labels, timestamps, counters, keyboard hints: **JetBrains Mono** 600, 11 to 12 px, uppercase, 0.1em tracking for labels; sentence case for timestamps.
- Highlighted phrase in greetings: the key words sit in an accent-filled pill with outline (`your head`, `rent free`, `mess`, `3am`).
- Load both through `next/font/google` with `display: swap` and subset latin.

### 3.4 Themes and the header toggle
- Values: `day`, `midnight`, `auto`. Stored in `profiles.theme` and mirrored to a `scraps-theme` cookie so the server renders the right `data-theme` with no flash. Signed-out pages read the cookie only.
- `auto` resolves from `prefers-color-scheme` (dark = midnight). Resolve before first paint with a tiny inline script in `<head>` that reads the cookie and media query.
- **Toggle placement: always in the header**, right side, before the other header actions:
  - Desktop board: right of the greeting block, before "switch layout" and "new scrap". Size 96 x 52.
  - Editor top bar: before the "saved" chip. Size 78 x 44.
  - Phone home: header row, left of the avatar. Size 78 x 44.
  - Phone note screen and quick capture sheet: no toggle (they are sub-screens).
- **Toggle anatomy:** pill with outline; sun icon on the left, moon on the right; a 34 to 40 px circular knob filled yellow sits behind the active icon. Daylight: white track, knob on sun. Midnight: `--surface` track, knob on moon (moon drawn in `--on-accent`).
- Implement as `<button role="switch" aria-checked={isMidnight} aria-label="after midnight">`. Tapping sets an explicit `day` or `midnight`. Settings offers "match my device" to return to `auto`.
- Theme change cross-fades background and surfaces over `--dur-slow`; the knob slides over `--dur-fast`.
- **Night copy:** when the resolved theme is midnight, greeting and empty-state strings switch to the night set (section 4.2).

### 3.5 Shape, outline, shadow, tilt
- Outlines: `--border` (2.5px) on cards, panels, inputs, buttons; `--border-sm` (2px) on chips, small tags, checkboxes inside cards, polaroid inner frames.
- Shadows: hard, zero blur. Cards `--shadow-lg`, panels `--shadow-md`, buttons `--shadow-sm` to `--shadow-lg` (primary CTA `--shadow-lg`). Pressed state removes the shadow and translates the element by the shadow offset.
- Radii: card 22, panel 20, control 16, small 12, tiny 8, pill 999.
- **Tilt:** board cards rotate by one of `--tilt-1..4`, chosen from a hash of the note id so a card always keeps its tilt. Hover/focus rotates to 0 and lifts 3px. A user setting "tidy mode" removes tilt. Reduced-motion removes tilt and transitions.
- Decorations: washi tape strip (lime, 86 x 26, rotated -5deg) on polaroid cards; stickers can overlap card corners by up to 20px.

### 3.6 Icons and stickers
- UI icons: lucide-react at stroke width 2.4 (2.2 to 2.6 is fine), `currentColor`, 18 to 24 px.
- Brand mark: 46 px rounded square, rotated -6deg. Daylight: lime fill with a sparkle. Midnight: yellow fill with a crescent moon.
- **Stickers** are SVG illustrations with ink outlines, in a sticker pack (`packages/ui/stickers`). v1 pack: smiley, sleepy moon, heart, sparkle, lightning, flower, speech bubble, planet, zzz, sun. Stickers are used as page icons, as inline sticker blocks, and in the sticker drawer. Never use emoji characters as stickers.

### 3.7 Motion
- Card hover: untilt and lift, `--dur-base`.
- Checkbox tick: box fills, check stroke draws (`stroke-dashoffset`), row text strikes through and drops to 55% opacity.
- Progress bars animate width over 300ms.
- Selected type tile in quick capture lifts by 2px with a shadow.
- Sheet open: slide up from bottom with `--ease-out`, `--dur-slow`.
- Completing a whole checklist: a small burst of 6 sparkle stickers from the counter (skip on reduced motion).
- No parallax, no auto-playing loops.

### 3.8 Layout and breakpoints
- `< 640px` phone: single column, 18px gutters, bottom tab bar (84px) with raised centre "+" button.
- `640 to 1023px` tablet: board in 2 columns, sidebar collapses to a drawer opened from the logo.
- `>= 1024px` desktop: 260px sidebar plus content; board uses CSS columns `columns: 4 250px` with 24px gaps (masonry by column).
- Editor content max width 860px with a 52px block gutter on the left for the "+" and drag handle; right rail (sticker drawer, page outfit, activity) wraps under the page below 1100px.

---

## 4. Voice and copy

### 4.1 Rules
- Lowercase UI copy, short, friendly, a bit chaotic. Speak like a friend in the group chat, never like a bank.
- Buttons are verbs: "new scrap", "save it", "paste", "share".
- Mono labels for metadata: "2 min ago", "48 words", "4/7".
- Errors say what happened and what to do: "couldn't upload that pic. we'll retry when you're back online."
- No em-dashes in UI copy.

### 4.2 String sets (put all strings in `apps/web/src/copy/en.ts`)

| Key | Daylight | After midnight |
|---|---|---|
| board.greeting | gm bestie. what's living in **your head** today? | it's 3am. what's living **rent free** in your head? |
| board.kicker | {weekday} · {space} | {time} · {space} |
| phone.greeting | gm. what's the **mess** today? | still up? same. spill the **3am** thoughts. |
| phone.section | pinned | tonight |
| search.placeholder | find that one thing… | find that 3am thought… |
| capture.label | what's on your mind | what's keeping you up |
| capture.placeholder | type anything. we'll figure out what it is. | 3am thought? spill it. we'll sort it out in the morning. |
| capture.save | save it | save it, sleep |
| streak.title | streak · {n} days | night owl streak · {n} nights |
| streak.body | dump one thought today to keep it alive. | log one 3am thought to keep it alive. or, hear us out, sleep. |
| empty.board | it's quiet in here. drop your first scrap. | nothing yet. the night is young. |
| list.cheer.none / some / almost / all | fresh start, let's go / making moves / so close, keep going / all done. iconic. | the night is young (sadly) / winding down / almost horizontal / goodnight. iconic. |
| offline.chip | offline · saved on this device | offline · saved on this device |
| sync.chip | saved / syncing… | saved / syncing… |

Greeting time logic: "gm" variants before 12:00, "afternoon" variant 12:00 to 17:59 ("hey bestie. what's on the brain this afternoon?"), "evening" 18:00 to 23:59 ("evening. what's still rattling around up there?"). Night copy whenever the theme is midnight.

---

## 5. Information architecture

```
auth (sign in / magic link / onboarding)
app
├── board  /            all scraps in the current space (default: brain dump)
│   ├── /s/[spaceId]    a space's board
│   └── filters: everything · notes · lists · pics · links · voice
├── note   /n/[noteId]  block editor (full page desktop; full screen on phone)
├── capture             sheet over any screen (phone "+" / desktop "new scrap" / key N)
├── search              command palette (⌘K / Ctrl K), full results page on phone
├── spaces              create, rename, recolour, members & invites, trash
├── settings            profile, theme, tidy mode, AI suggestions, capture tokens, sign out
└── /share-target       PWA share target landing (posts into capture)
```

Desktop sidebar: brand, search field (⌘K hint), "your spaces" list with colour dot and count, "new space", streak card at the bottom.
Phone tab bar: home, spaces, raised "+" capture, lists, profile.

---

## 6. Screens

Each screen exists in both themes. Artboard file names are in brackets.

### 6.1 Board, desktop (`Main`, `Midnight-Main`)
- **Sidebar** (260px, `--surface`, right edge `--divider`): brand mark + "scraps." wordmark 34px; search field (48px high, `--surface-2`, ⌘K key cap); "your spaces" mono label; space rows (44px min, colour square, name, mono count; active row uses `--inverse-bg` / `--inverse-ink`); dashed "new space" row; streak card pinned to the bottom (lime by day, lilac at night).
- **Header**: mono kicker, greeting h1 (`--text-hero`) with highlighted phrase; right side: theme toggle, "switch layout" icon button (52 x 52), "new scrap" primary button (accent fill, `--shadow-lg`). At night three small sparkle stars sit in the header area (decorative, `aria-hidden`).
- **Filter chips**: pill buttons 44px high with mono counts. Active chip uses inverse colours plus an accent shadow. Filtering is instant (client-side on the loaded page, server query for more).
- **Masonry board**: cards in CSS columns, pinned first then most recently edited. Infinite scroll in pages of 40.
- "Switch layout" toggles between masonry and a compact list (title, kind icon, space, edited time) and remembers the choice per device.

### 6.2 Phone home (`Phone-Home`, `Midnight-Phone-Home`)
- Header row: brand mark 36px + wordmark 28px on the left; theme toggle and avatar (44px circle) on the right.
- Greeting h1 32px; search field 50px; horizontally scrolling filter chips; section label with "see all".
- Two-column card stack (cards smaller: titles 19px, body 13px).
- Bottom tab bar as in section 5. The "+" is a 68px rounded square, pink, rotated -4deg, raised 34px.

### 6.3 Note editor, desktop (`Editor`, `Midnight-Editor`)
- **Top bar** (`--surface`): brand mark, breadcrumb (space / note title, truncates); right side: theme toggle, sync chip ("saved" lime / "syncing…" / "offline · saved on this device"), presence avatars (overlapping 36px circles, max 3 then "+N"), "share" button.
- **Cover**: 210px band, outline + `--shadow-lg`. Cover types: pattern (stripes in two accents), illustration (moonlit scene at night), uploaded image. "change cover" button top right.
- **Page icon**: 92px rotated sticker tile overlapping the cover by 46px.
- **Title**: `--text-page-title`, editable, placeholder "untitled scrap".
- **Property chips**: "vibe", "when" (date or range), tags (coloured chips). Add chip button at the end.
- **Blocks** (section 8.2) in a column with 18px gaps; each block has a hover gutter with "+" (insert below) and a 6-dot drag handle.
- **Slash menu**: typed "/" opens "drop a block" menu (380px max, outline, `--shadow-xl`): icon tile, name, one-line description, mono shortcut. Arrow keys move, Enter inserts, typing filters.
- **Right rail** (240px min): sticker drawer (3 x 2 grid of stickers, drag onto the page or click to insert at cursor), page outfit (page accent swatches; changes the page's cover and highlight accent only), activity box (dashed outline: word count and people, last edit, recent events).

### 6.4 Quick capture sheet (`Phone-Capture`, `Midnight-Phone-Capture`)
- Bottom sheet 676px tall on phone over a scrim; centred modal 560px wide on desktop.
- Grab handle; "new scrap" title (moon sticker at night); close button.
- Textarea "what's on your mind" (autofocus).
- "or pick a type": 3 x 2 grid of type tiles (text, list, pic, link, voice, sticker), radio-group semantics. Choosing a type changes what the sheet shows: list adds an item input, pic opens the camera/file picker, link shows a URL field, voice shows a record button, sticker shows the pack.
- **Clipboard suggestion**: if the clipboard holds a URL (read only after the user taps "paste", never silently), show "link on your clipboard" row with a "paste" button.
- Footer: space picker (colour dot + name + chevron) and the primary "save it" button.
- After saving: the sheet closes, the new card appears at the top of the board with a short pop, and if AI suggestions are on, a suggestion toast appears (section 9.5).

### 6.5 Note on phone (`Phone-List`, `Midnight-Phone-List`)
- Header: back button, mono space label, "more" menu (share, move, colour, sticker, pin, delete).
- Title row with sticker; property chips; for checklist-led notes a progress card (count, cheer line, progress bar).
- Blocks render full width. Floating block toolbar 64px at the bottom (text, checklist, image, link, voice, sticker) replacing the slash menu on touch. The toolbar inverts colours (ink fill by day, off-white fill at night).

### 6.6 Auth and onboarding
- Sign-in page: big wordmark, one email field, "send magic link", "continue with google". Copy: "your brain, but organised-ish."
- After the first sign-in: pick a display name and an avatar sticker, then the app creates the "brain dump" space (yellow) and three starter scraps from seed templates (a welcome note, a sample checklist, a sample moodboard) that the user can delete.

### 6.7 Settings
Sections: profile (name, avatar sticker), look (theme: daylight / after midnight / match my device; tidy mode on/off), AI (suggestions on/off with one-line explanation of what is sent), capture (create/revoke tokens for the iOS shortcut, link to install the shortcut, instructions), data (export all notes as Markdown + media zip), account (sign out, delete account).

### 6.8 Share a space
Dialog from "share": member list with role selects (owner, editor, viewer), "invite link" with role and expiry (7 days default), copy button, revoke. Viewers see the editor read-only with a "view only" chip in the top bar.

### 6.9 Search
⌘K palette: search field, results grouped (scraps, spaces, actions such as "new scrap", "switch to after midnight"). Each result shows kind icon, title, matched snippet with the match highlighted in a yellow pill, space name. Enter opens. Phone: full-screen search reached from the search field.

### 6.10 Trash
Per-space list of deleted scraps with "restore" and "delete forever" (confirm dialog, owner only). Auto-purged after 30 days.

### 6.11 States
- **Empty board**: big sticker, empty-state copy, "new scrap" button.
- **Loading**: skeleton cards with outlines and no fill animation beyond a gentle opacity pulse (none on reduced motion).
- **Offline**: sync chip turns to the offline variant; a thin dashed banner under the header on first offline event: "you're offline. keep going, we'll sync later."
- **Errors**: inline, in a yellow callout block style with an action.
- **Permission denied / note not found**: full-page sticker + "this scrap isn't yours to see" + back to board.

---

## 7. Component catalogue (`packages/ui`)

Build these first (Phase 0/1) with a `/styleguide` route showing every variant in both themes.

| Component | Variants and notes |
|---|---|
| `Button` | primary (accent fill, `--shadow-lg`), dark (inverse), ghost (surface + outline), icon (52 / 44 sizes, needs `aria-label`); pressed state shifts by shadow offset |
| `Chip` | filter (toggle, `aria-pressed`), property (label + value), tag (accent fill), count badge |
| `ThemeToggle` | sizes `lg` (96 x 52) and `md` (78 x 44); see 3.4 |
| `Card` | base outline/radius/shadow/tilt wrapper; colour prop maps to fill + `--card-shadow-*`; tilt from note id |
| `NoteCard.*` | Text, Checklist, Pic (polaroid + tape), Link (media header + domain), Voice (play button + waveform + transcript excerpt), Quote (big text + sticker), Recipe-style tag list. All live in `packages/ui/cards` |
| `Checkbox` | 26 to 28 px rounded square; checked fill ink by day, lime at night |
| `ProgressBar` | outlined pill track, ink/near-black fill |
| `Waveform` | bars from stored peaks, 4px wide, 3px gap; plays progress colour |
| `Avatar` / `AvatarStack` | sticker or initials on accent fill, outline |
| `Sticker` | renders a sticker by id at any size |
| `Sheet` / `Dialog` | focus trap, scrim, Escape closes, returns focus |
| `Menu` | slash menu and context menus (roving focus) |
| `Toast` | bottom-centre on phone, bottom-right desktop; AI suggestion variant with accept/dismiss |
| `SearchField` | with key cap hint on desktop |
| `SyncChip` | saved / syncing / offline / error |
| `SpaceDot` | colour square with outline |
| `Skeleton` | outline-only placeholder card |
| `Tape`, `Sparkle` | decorative, `aria-hidden` |

---

## 8. Notes, blocks and cards

### 8.1 What a note is
- A note has metadata in Postgres (`notes` table) and content in a Yjs document (`note_docs.ydoc`) holding a ProseMirror (Tiptap) document in the `default` XML fragment.
- **Kind** is derived, not chosen, from the first meaningful block: checklist → `list`, image or image grid → `pic`, link embed → `link`, voice memo → `voice`, big text → `quote`, anything else → `text`. Quick capture's type tile just decides which block the new note starts with.
- **Card colour**, **icon sticker**, **cover**, **pinned** and **tags** are metadata the user sets directly.
- **Title** is a dedicated `title` node: the first node of every document, one line, always present (placeholder "untitled scrap"). `notes.title` is derived from it. The editor top bar and cards read the title from there, never from the first heading.

### 8.2 Blocks (Tiptap nodes in `packages/editor`)

| Block | Markdown / shortcut | Notes |
|---|---|---|
| Paragraph | default | inline marks: bold, italic, strike, code, highlight (yellow pill), link |
| Heading 1 to 3 | `#`, `##`, `###` | H2 is the section style in the editor design |
| Bullet / numbered list | `-`, `1.` | |
| Checklist | `[]` or `[ ]` | task items with checkbox, optional assignee (space member avatar) and due date |
| Callout | `/callout` | yellow fill by default, colour picker, sticker icon |
| Quote / big text | `>` / `/big` | big text renders at `--text-quote` and makes the card a quote card |
| Divider | `---` | |
| Image | drop, paste, `/img` | single image with caption; polaroid frame option |
| Mood board | `/mood` | 2 to 9 images in a grid, each polaroid with caption, slight alternating tilt |
| Link embed | paste a URL on an empty line, `/url` | unfurled card: thumbnail or icon tile, domain, title, description; YouTube shows duration; maps links show a pin tile |
| Voice memo | `/rec` | record, play, waveform, duration, author; transcript shown under it (collapsible) |
| Sticker | `:` | inline sticker 48 to 96 px, draggable within the page |
| Table | `/tbl` | simple table, header row toggle |
| Code | ```` ``` ```` | mono, no syntax highlight in v1 |

Each block gets a stable id (Tiptap UniqueID or equivalent) for comments later and for drag.

### 8.3 Card preview extraction
The collab server derives preview fields whenever it stores a document (debounced 2 s) and writes them to `notes`:
- `title` (text of the `title` node, max 120 chars), `preview_text` (first 280 chars of plain text after the title), `kind`, `word_count`.
- `preview` JSON: `{ checklist: {done, total, items: first 4}, images: [assetId x up to 4], link: {url, title, domain, image, duration}, voice: {assetId, durationMs, excerpt}, quote: "text", tags: [...] }`.
- `search_text` for full-text search: title + all text + checklist items + link titles. The extractor owns this column and rewrites it on every store.
- `transcript_tsv` holds the transcripts of the note's audio assets. It is maintained only by a trigger on `assets`, so an extractor write never clobbers it. Search matches `search_text || transcript_tsv`.

### 8.4 Card rendering rules

| Kind | Card | Shows |
|---|---|---|
| text | colour fill, padding 20 | mono label pill (space or first tag), title, 2 to 3 lines body, footer "2 min ago · 48 words" |
| list | lime by default | title, `done/total` badge, first 4 items as live checkboxes (toggling updates the doc through the collab connection), progress bar |
| pic | polaroid (surface frame, inner image, tape) | first image, title, "+N pics" |
| link | blue | media header (thumbnail or pattern) with play button for video and duration badge, domain row, title, description |
| voice | lilac | play button, waveform, duration, title, transcript excerpt in a mono speech box |
| quote | pink | big text, sticker overlapping the top-right corner, "pinned · forever" style footer when pinned |

---

## 9. Feature specs

### 9.1 Spaces and sharing
- Every user has at least one space. Spaces have name, colour, icon sticker and members with roles.
- Owner: everything including delete space, manage members. Editor: create/edit/delete notes, invite viewers. Viewer: read only.
- Invite links carry a random token (store only its hash), role and expiry. Accepting requires sign-in and adds a `space_members` row.
- Moving a note between spaces requires editor rights in both.

### 9.2 Live co-editing
- Tiptap Collaboration over Hocuspocus. One WebSocket per open note on the client (Hocuspocus multiplexing is fine if available).
- **Auth:** the client sends the Supabase access token. `onAuthenticate` verifies the JWT, loads the note's space and the user's role, rejects non-members, and sets `connection.readOnly = true` for viewers.
- **Presence:** awareness state `{ userId, name, color, avatarSticker }`. Avatars in the top bar; coloured carets with name labels in the page (caret colour from the user's accent).
- **Persistence:** Hocuspocus database extension loads `note_docs.ydoc` and stores merged state on change (debounced 2 s, max wait 10 s) plus on last disconnect. Also write `notes.updated_at` and `last_edited_by`.
- **Card checklist toggles** on the board apply through a short-lived provider connection or a server endpoint on the collab server that applies the change to the Y doc. Never edit `note_docs` from the web app directly.
- Target: 10 concurrent editors per note, 1,000 concurrent connections per collab instance.

### 9.3 Images
- Accept JPEG, PNG, WebP, HEIC (convert in the browser where supported; otherwise upload original and convert in an Edge Function), GIF (kept as is up to 8 MB).
- Client resizes to max 2048px long edge, WebP quality 0.82, strips EXIF location.
- Upload to `media/{note_id}/{asset_id}.webp` (keyed by note, not space, so moving a note between spaces never touches storage), insert an `assets` row, then insert the block with `assetId`. Render with signed URLs (1 hour) cached in memory; blur-free placeholder uses the stored dominant colour.

### 9.4 Voice memos
- Record with `MediaRecorder` (Opus/WebM where supported, AAC/MP4 on iOS Safari). Max 5 minutes, with a visible timer and a soft warning at 4:30.
- Compute 64 to 120 waveform peaks client-side while recording; store with the asset.
- Upload, insert asset (`transcript_status = 'pending'`), insert the voice block.
- **Transcription:** an Edge Function (`transcribe-audio`) is triggered by a database webhook on new audio assets, sends the file to the configured `TranscriptionProvider`, writes `assets.transcript` and status. The voice block subscribes to its asset row (Supabase Realtime) and shows "transcribing…" then the text. The transcript is not written into the Y doc; it is rendered from the asset so it never conflicts with edits. A "copy into note" action inserts it as a paragraph.
- Failure: status `failed` with "retry" in the block menu.

### 9.5 AI auto-sort and tags
- Trigger: after a scrap is saved from quick capture or the share target, and on demand from the note menu ("suggest where this goes").
- Edge Function `ai-sort` sends to Claude (`claude-haiku-5-5`): the scrap's title and up to 2,000 chars of text, link title/domain if any, transcript excerpt if any, the user's space names with ids, and up to 50 existing tag names. It asks for strict JSON: `{ spaceId | null, tags: string[] (max 3, prefer existing), title: string | null, confidence: 0..1 }`. Validate with zod; drop invalid output silently.
- Store in `ai_suggestions` with status `pending`. The client shows a toast: "file under **side quests**? add #travel #money" with "yes" and "nah". Accept applies the changes as the user (normal RLS paths) and marks `accepted`.
- Never apply automatically. Skip suggestions under confidence 0.5. Rate limit 60 calls per user per hour. Respect the settings toggle. `profiles.ai_enabled` defaults to **false**: the first capture shows a one-time "turn on suggestions?" prompt that states exactly what is sent, and nothing is called until the user says yes.

### 9.6 Share-sheet capture
- **Android and desktop Chrome/Edge (installed PWA):** manifest `share_target` with `method: POST`, `enctype: multipart/form-data`, accepting `title`, `text`, `url` and files (`image/*`, `audio/*`). The service worker intercepts the POST at `/share-target`, stores payload and files in IndexedDB, and redirects to `/?capture=shared` which opens the capture sheet prefilled. Works offline.
- **iOS:** Settings → capture lets the user create a capture token (shown once) and install an Apple Shortcut "Send to Scraps" (share-sheet enabled for URLs, text and images). The shortcut POSTs to the `capture` Edge Function with `Authorization: Bearer <token>`. The function validates the token hash, creates the note in the user's default capture space (default: brain dump) with the right starting block (via the collab server's create-note endpoint), and returns `{ noteId }`. Document the shortcut steps in-app with screenshots.
- **Everywhere:** "paste" in quick capture, drag-and-drop files or URLs onto the desktop board to create a scrap.

### 9.7 Streak
Computed by a SQL view over `note_activity` (one row per user per local day with any create/edit, written by the collab server and note creation). Shows current streak; the counter turns into a sparkle burst on the first scrap of a day.

### 9.8 Search
Postgres full-text search on `notes.search_text` (`tsvector`, `english` config plus `simple` for slang) with `websearch_to_tsquery`, ranked by `ts_rank` and recency, scoped by RLS. Add trigram index on `title` for fuzzy matches. Offline: search the locally cached notes list by title and preview text.

### 9.9 Export and delete
Export: Edge Function builds a zip of Markdown files (one per note, front matter with space, tags, dates) plus media; emailed as a signed link. Delete account: removes the user's memberships, transfers or deletes owned spaces (prompt if shared), deletes storage objects.

---

## 10. Offline and sync

**Goal:** reading and editing never wait on the network. Nothing typed is lost.

- **App shell:** Serwist precaches the app shell, fonts, sticker SVGs and the offline route. Runtime cache: stale-while-revalidate for signed media URLs is not possible (they expire), so cache image responses by asset id with a custom cache key.
- **Note content:** each opened note gets a `y-indexeddb` persistence keyed by note id. Edits land in IndexedDB first, then sync through Hocuspocus when connected. Yjs merges concurrent offline edits.
- **Lists and metadata:** TanStack Query cache persisted to IndexedDB (notes list per space, spaces, profile). Stale data shows immediately.
- **Outbox:** creates and metadata mutations (new note, colour, pin, tags, move, delete) go to an IndexedDB outbox with client UUIDs and a client `meta_updated_at`. On reconnect the outbox replays in order; server uses upserts by id so replays are idempotent. Conflicts on metadata fields: last write wins by `meta_updated_at`. `notes.updated_at` is bumped by content edits (collab server) and is for ordering the board only; it is never used for conflict resolution.
- **Offline-created notes:** get a client UUID and a local Y doc immediately. On sync: outbox creates the `notes` row, then the provider connects and pushes the doc.
- **Uploads:** blobs wait in IndexedDB with the asset id already referenced by the block (the block shows the local blob URL until upload completes).
- **Storage durability:** call `navigator.storage.persist()` after sign-in. iOS can still evict data for non-installed web apps, so the sync chip warns when there are unsynced changes older than 24 hours.
- **Prefetch:** when online, keep the 50 most recently opened notes cached locally.
- **Sync status:** global store drives the `SyncChip`: `saved` (no pending work), `syncing` (outbox or doc updates in flight), `offline` (navigator offline or socket down for > 3 s), `error` (replay failed 3 times; tap for details).

---

## 11. Architecture and data model

### 11.1 System diagram

```
            ┌────────────── browser (PWA) ──────────────┐
            │ Next.js app ─ TanStack Query ─ outbox      │
            │ Tiptap + Yjs ─ y-indexeddb                 │
            │ Serwist service worker (shell, share POST) │
            └──────┬───────────────┬─────────────┬──────┘
          HTTPS    │     WebSocket │             │ HTTPS
                   ▼               ▼             ▼
      Supabase (PostgREST,   Hocuspocus     Supabase Edge Functions
      Auth, Storage,         (apps/collab)  unfurl-link, transcribe-audio,
      Realtime)              │              ai-sort, capture, export
                   ▲         │ service role       │
                   └─────────┴──── Postgres ──────┘
                                         │
                       Claude API  ◄─────┤  STT provider
```

### 11.2 Tables (all with RLS)

```sql
profiles        (id uuid pk references auth.users, display_name text, avatar_sticker text,
                 theme text check (theme in ('day','midnight','auto')) default 'auto',
                 tidy_mode bool default false, ai_enabled bool default false,
                 timezone text default 'UTC', default_capture_space uuid, created_at, updated_at)

spaces          (id uuid pk, owner_id uuid, name text, color text check (color in
                 ('yellow','lime','pink','blue','lilac','orange')), icon_sticker text,
                 created_at, updated_at, deleted_at)

space_members   (space_id uuid, user_id uuid, role text check (role in ('owner','editor','viewer')),
                 joined_at, primary key (space_id, user_id))

space_invites   (id uuid pk, space_id uuid, token_hash text unique, role text, created_by uuid,
                 expires_at timestamptz, max_uses int default 20, uses int default 0, revoked_at)

notes           (id uuid pk /* client-generated v7 */, space_id uuid, created_by uuid,
                 last_edited_by uuid, kind text, color text, icon_sticker text, cover jsonb,
                 title text, preview_text text, preview jsonb, word_count int,
                 pinned bool default false, search_text tsvector, transcript_tsv tsvector,
                 meta_updated_at timestamptz /* LWW clock for metadata, see section 10 */,
                 created_at, updated_at /* content/board order only */, deleted_at)

note_docs       (note_id uuid pk references notes on delete cascade, ydoc bytea, updated_at)
                 -- no client policies at all; only the service role (collab server) reads/writes

tags            (id uuid pk, space_id uuid, name text, color text, unique (space_id, lower(name)))
note_tags       (note_id uuid, tag_id uuid, primary key (note_id, tag_id))

assets          (id uuid pk, note_id uuid, space_id uuid, uploader_id uuid,
                 kind text check (kind in ('image','audio')), storage_path text, mime text,
                 bytes int, width int, height int, dominant_color text, duration_ms int,
                 waveform jsonb, transcript text, transcript_status text default 'none', created_at)

link_previews   (url_hash text pk, url text, title text, description text, image_url text,
                 site_name text, duration_s int, fetched_at)   -- shared cache, read-only to clients

ai_suggestions  (id uuid pk, note_id uuid, user_id uuid, space_id uuid, tags text[], title text,
                 confidence real, status text default 'pending', model text, created_at)

capture_tokens  (id uuid pk, user_id uuid, token_hash text unique, label text,
                 created_at, last_used_at, revoked_at)

note_activity   (user_id uuid, day date, primary key (user_id, day))
```

Indexes: `notes (space_id, pinned desc, updated_at desc) where deleted_at is null`, GIN on `notes.search_text` and `notes.transcript_tsv`, trigram on `notes.title`, `assets (note_id)`, `space_members (user_id)`.

### 11.3 RLS outline
- Helper `public.space_role(space uuid) returns text` (security definer, stable): the caller's role or null.
- `spaces`: select if member; insert by any authenticated user (trigger adds owner membership); update if owner; delete (soft) if owner.
- `space_members`: select if member of the same space; insert/update/delete if owner (editors may insert viewers).
- `notes`: select if member; insert/update if editor or owner of `space_id` (and of the new `space_id` on move); delete is a soft delete via update.
- `tags`, `note_tags`, `assets`: follow the parent note's space.
- `ai_suggestions`, `capture_tokens`, `profiles`: owner of the row only.
- `link_previews`: select for authenticated; writes only from service role.
- `note_docs`: RLS enabled, no policies (service role only).
- Storage `media` bucket: object path's first segment is `note_id`; the policy resolves the note's current space (`notes.space_id`) and applies `space_role()`: read if member, write if editor or owner. `assets.space_id` is kept in sync by a trigger on `notes.space_id` changes.

### 11.4 Edge Functions
| Function | Trigger | Does |
|---|---|---|
| `unfurl-link` | client call with URL | SSRF-safe fetch (block private, loopback, link-local and metadata IPs after DNS resolution; HTTPS and HTTP only; 5 s timeout; 1 MB cap; max 3 redirects re-checked each hop), parse Open Graph/oEmbed, cache in `link_previews` for 7 days |
| `transcribe-audio` | DB webhook on `assets` insert where kind = audio | download from storage, call provider, update asset |
| `ai-sort` | client call after capture | section 9.5 |
| `capture` | Apple Shortcut POST | token auth, create note through collab server, return id |
| `export` | client call | section 9.9 |

### 11.5 Collab server (`apps/collab`)
- Hocuspocus 4 with: `onAuthenticate` (JWT + role), database extension (`fetch`/`store` against `note_docs` with the service role), debounced preview extraction using the shared schema from `packages/editor` (Tiptap transformer from Y doc to JSON), `note_activity` upsert, an HTTP endpoint `POST /notes` (create a note with an initial block, used by `capture`) and `POST /notes/:id/checklist` (toggle an item from a board card), both requiring a valid JWT or an internal shared secret.
- Health check endpoint, structured logs, graceful shutdown that flushes pending stores.

### 11.6 Environment variables
Web: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_COLLAB_URL`.
Collab: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` (or JWKS URL), `INTERNAL_SECRET`.
Functions: `ANTHROPIC_API_KEY`, `TRANSCRIPTION_PROVIDER`, `TRANSCRIPTION_API_KEY`, `COLLAB_INTERNAL_URL`, `INTERNAL_SECRET`.

---

## 12. Security and privacy
- RLS everywhere, tested. Service role only server-side.
- Capture tokens: 32 random bytes, shown once, stored as SHA-256 hash, revocable, rate-limited (30/min).
- Invite tokens: same handling.
- Signed URLs for all media; no public buckets.
- CSP: `default-src 'self'`, connect to Supabase, collab and nothing else; images from Supabase storage and `link_previews` image hosts proxied through a Next.js image route so arbitrary third-party hosts are not hit by clients directly.
- AI: only the fields listed in 9.5 are sent; no images or audio. Off until the user opts in (9.5).
- Transcription: voice memo audio is sent to the transcription vendor (Groq Whisper by default). The privacy page names the vendor, and the voice block shows a one-time note before the first memo is transcribed.
- Age: sign-up asks for year of birth and blocks under 16 (the product targets 17 to 27). Revisit with counsel before launch. The prompt instructs the model to treat note text as data. Output is schema-validated.
- Strip EXIF GPS from images. Never log note content on the server.
- Account deletion removes live data immediately and from backups within 30 days; the privacy page says so.

---

## 13. Accessibility
- WCAG 2.2 AA. Contrast pairs per `tokens.css`. Focus ring 3px `--focus-ring` with 2px offset on every control.
- Keyboard: full board navigation (arrow keys between cards, Enter to open), editor shortcuts, `N` new scrap, `⌘K` search, `Esc` closes sheets and menus.
- Cards are links (`<a href="/n/id">`) with an accessible name of the title; inline checkboxes inside cards are separate buttons with `aria-pressed`.
- Theme toggle is a `switch`. Type tiles are a `radiogroup`. Filter chips use `aria-pressed`.
- Voice memos: transcripts double as text alternatives; play buttons labelled with title and duration.
- Images: alt text field on image blocks (AI can suggest later, not v1).
- Respect `prefers-reduced-motion` and `prefers-contrast: more` (thicker 3px outlines, no tilt).

---

## 14. Performance budgets
- Board first load on a mid-range phone over 4G: LCP < 2.5 s, INP < 200 ms, CLS < 0.05.
- JS on the board route < 180 KB gzipped (the editor bundle loads only on note routes).
- Opening a cached note: content visible < 150 ms from tap.
- Typing latency in a 5,000-word doc with 3 collaborators: no frame over 50 ms.

---

## 15. Out of scope for v1
Native apps (Expo, iOS share extension, widgets), comments and mentions, version history UI (Yjs snapshots stored, no UI), public web publishing of notes, reminders and notifications, calendar view, templates gallery beyond starter scraps, AI writing or summarising, end-to-end encryption, payments.
