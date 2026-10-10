# Later: native app (not v1)

Planning notes only. Do not build in v1.

- **App:** Expo (React Native) with Expo Router, sharing `packages/db`, copy strings, tokens (converted to a JS theme object) and business logic. The editor runs Tiptap inside a WebView initially (shared `packages/editor` bundle), with native node views considered later.
- **Why native:** iOS share extension (replaces the Shortcut), home screen widgets ("new scrap" and "today's list"), reliable offline storage on iOS, push notifications for co-editing activity, Apple sign-in.
- **Data:** same Supabase project and collab server. Yjs persistence via a native IndexedDB-equivalent store.
- **Pre-work during v1 that keeps this cheap:** keep business logic out of React components (`packages/db` hooks, pure functions for preview, kind, greeting, streak); keep tokens in `tokens.css` mirrored by a generated `tokens.ts`.
