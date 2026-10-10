# Phase 1: Auth, spaces and app shell

**Goal:** people can sign in, get a first space, and move around the app shell on desktop and phone. The full v1 schema and RLS exist from here on.

**Depends on:** Phase 0. **Read:** SPEC 5, 6.6, 6.7 (look section), 9.1 (data), 11.2, 11.3, 11.6, 12.

## Tasks

- [x] **1.1 Schema migration.** Create every table in SPEC 11.2 (including ones used later, so later phases add columns rather than tables), indexes, `updated_at` triggers, and the `space_role()` helper. Enable RLS on all tables.
- [x] **1.2 RLS policies.** Implement SPEC 11.3 for `profiles`, `spaces`, `space_members`, `space_invites`, `notes`, `tags`, `note_tags`, `assets`, `ai_suggestions`, `capture_tokens`, `link_previews`, `note_docs` (no policies), `note_activity`. Trigger on `spaces` insert adds the creator as owner.
- [x] **1.3 RLS tests.** SQL tests in `supabase/tests` (pgTAP or plain SQL assertions run by `pnpm db:test`) covering: non-member cannot read a space or its notes; viewer cannot update notes; editor can; only owner manages members; `note_docs` unreadable by `authenticated`.
- [x] **1.4 Storage.** Private `media` bucket with policies keyed on the first path segment (`space_id`).
- [x] **1.5 Types.** `pnpm db:types` generates `packages/db/src/types.ts`; zod schemas for the client-facing shapes.
- [x] **1.6 Auth.** Supabase Auth with email magic link and Google. `@supabase/ssr` clients for server components, route handlers and the browser. Middleware refreshes the session and protects app routes. Sign-in page per SPEC 6.6.
- [x] **1.7 Onboarding.** First sign-in flow: year-of-birth age gate (block under 16), display name, avatar sticker picker, then create "brain dump" (yellow) and set it as `default_capture_space`. Starter scraps are added in Phase 3 once cards exist.
- [x] **1.8 Theme persistence.** Sync `profiles.theme` with the cookie: signing in applies the stored theme; toggling writes both.
- [x] **1.9 App shell, desktop.** Sidebar per SPEC 6.1 (brand mark switches sparkle/moon by theme, search field stub, spaces list with counts, "new space" dialog with name and colour, streak card placeholder). Header region with greeting (copy from `t()`), `ThemeToggle`, and placeholder actions.
- [x] **1.10 App shell, phone and tablet.** Phone header (brand, `ThemeToggle`, avatar), bottom tab bar (home, spaces, raised "+", lists, profile). Tablet: sidebar as a drawer from the brand mark.
- [x] **1.11 Settings (first cut).** Profile name and avatar, theme (daylight / after midnight / match my device), tidy mode, sign out.
- [x] **1.12 Seed.** `seed.sql` with two demo users and spaces matching the design (brain dump, uni stuff, side quests, moodboards, recipes i'll never make) for local development.

## Acceptance criteria
- [~] Magic link works locally (mail is in Mailpit, not Inbucket) and redirects to the board shell. Google sign-in is built and shows a clear message until a Google OAuth client is configured (see PROGRESS.md); not verified end to end.
- [x] A new user lands in onboarding, then sees "brain dump" selected in the sidebar.
- [x] Creating, renaming and recolouring a space works; counts show 0.
- [x] All RLS tests pass; a manual check with a second user confirms they cannot see the first user's spaces.
- [x] Shell matches the artboards at 1440px and 390px in both themes; header toggle is present on desktop board header and phone home header.

## Tests (minimum)
- SQL: policy tests from 1.3.
- E2E: sign in with magic link (Inbucket), complete onboarding, create a space, switch theme, sign out, sign back in and see the theme kept.

## Out of scope
Notes content, board cards, sharing UI.
