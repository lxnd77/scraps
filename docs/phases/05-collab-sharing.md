# Phase 5: Live co-editing and sharing

**Goal:** friends share a space and edit the same page at the same time, with avatars and named carets. Viewers can read but not change anything.

**Depends on:** Phase 4. **Read:** SPEC 6.3 (top bar), 6.8, 9.1, 9.2, 12.

## Tasks

- [ ] **5.1 Invites.** Create invite links (role, expiry, max uses) from the share dialog; store only the token hash; accept route `/invite/[token]` (sign in first if needed) adds `space_members`; revoke. Editors can invite viewers only.
- [ ] **5.2 Members.** Share dialog per SPEC 6.8: member list, role select (owner only), remove member, leave space. Sidebar shows a small avatar stack on shared spaces.
- [ ] **5.3 Presence.** Collaboration caret extension with user name and accent colour; awareness drives the top-bar `AvatarStack` (max 3 + "+N") and the activity box ("dev edited at 2:51 am", "maya left a voice memo").
- [ ] **5.4 Read-only.** Collab server sets `readOnly` for viewers; editor shows a "view only" chip and disables slash menu, toolbar and card checkbox toggles; RLS already blocks metadata writes.
- [ ] **5.5 Role changes live.** When a member is removed or demoted, the collab server closes or downgrades their open connections within 5 seconds (listen to `space_members` changes via Realtime or poll on an interval).
- [ ] **5.6 Board realtime.** Supabase Realtime subscription on `notes` for the current space so new and edited cards from others appear without reload.
- [ ] **5.7 Assignees.** Checklist item assignee picker (space members) and avatar on the row, as in the editor artboard.
- [ ] **5.8 Load check.** Script that opens 10 headless clients on one note typing concurrently for 2 minutes; record latency and server memory in PROGRESS.md.

## Acceptance criteria
- [ ] Two browser contexts as different users edit one note; each sees the other's text within 500 ms locally, carets labelled with names.
- [ ] A viewer cannot type, toggle checklist items or change metadata (UI disabled and server rejects).
- [ ] Removing a member kicks their open editor to a "you no longer have access" state within 5 seconds.
- [ ] Invite link expires and max uses are enforced.

## Tests (minimum)
- SQL: invite and membership policies.
- E2E (two contexts): concurrent typing converges to identical content; viewer read-only; removal kicks; board shows the other user's new card live.

## Out of scope
Comments and mentions, per-note sharing, public links.
