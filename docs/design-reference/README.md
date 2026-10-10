# Design reference

These are the source files of the 10 artboards from the "Gen-Z Notes App" design canvas. They are design-canvas components (`.dc.html`), not app code: they rely on a canvas runtime (`support.js`, `<x-dc>`, `{{holes}}`, `<sc-for>`) that is not included, so they will not render if opened directly.

Read them as the exact reference for layout, spacing, sizes, copy and colours. The markup uses inline styles, so every measurement is visible in the file.

| File | Screen | Theme |
|---|---|---|
| `Main.dc.html` | Desktop board | daylight |
| `Midnight-Main.dc.html` | Desktop board | after midnight |
| `Editor.dc.html` | Desktop note editor | daylight |
| `Midnight-Editor.dc.html` | Desktop note editor | after midnight |
| `Phone-Home.dc.html` | Phone home | daylight |
| `Midnight-Phone-Home.dc.html` | Phone home | after midnight |
| `Phone-Capture.dc.html` | Phone quick capture sheet | daylight |
| `Midnight-Phone-Capture.dc.html` | Phone quick capture sheet | after midnight |
| `Phone-List.dc.html` | Phone checklist note | daylight |
| `Midnight-Phone-List.dc.html` | Phone checklist note | after midnight |

How to translate them:
- Hex values map to tokens in `docs/tokens.css` (for example `#111` and `#F4F0FF` both become `--ink` / `--line` depending on theme). Use tokens, never the hex.
- Prototype links between artboards (`<a href="Midnight-Main.dc.html">` on the theme toggle) become a `ThemeToggle` button that changes the theme in place.
- The JS in each file's `<script data-dc-script>` only drives the prototype (checkbox state, filter chips). Rebuild behaviour from SPEC.md.
- Sample copy in the artboards is demo content; use it in `supabase/seed.sql` so local demos match.
