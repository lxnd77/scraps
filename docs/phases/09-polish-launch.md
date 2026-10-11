# Phase 9: Polish, hardening and launch

**Goal:** the app feels finished, passes accessibility, performance and security checks, and runs in production with monitoring.

**Depends on:** Phase 8. **Read:** SPEC 3.7, 6.10, 9.9, 12, 13, 14.

## Tasks

- [x] **9.1 Motion pass.** Card hover lift/untilt, checkbox draw, progress fills, sheet slide, theme cross-fade, sparkle burst on completing a checklist and on the first scrap of the day. All disabled under reduced motion.
- [x] **9.2 Trash.** Per-space trash view, restore, delete forever (owner, confirm dialog), scheduled purge after 30 days (pg_cron or a scheduled Edge Function) that also removes storage objects.
- [x] **9.3 Export.** `export` function: Markdown per note with front matter, media files, zipped to a signed link; settings button with progress.
- [x] **9.4 Account deletion.** Flow from settings with handling of owned shared spaces (transfer or delete).
- [ ] **9.5 Accessibility audit.** axe on every route in both themes; manual keyboard and screen reader pass (VoiceOver on iOS Safari, TalkBack or NVDA); `prefers-contrast: more` styles. _(axe passes on every route in both themes on desktop, plus the dialogs; `prefers-contrast: more` is in. The VoiceOver, TalkBack or NVDA pass is a human step and was not done.)_
- [ ] **9.6 Performance.** Measure against SPEC 14 with Lighthouse CI on board and note routes; code-split the editor; lazy-load media node views; fix regressions. _(measured with `pnpm perf`: board 511 to 296 KB gzip and mobile performance 76 to 93, accessibility 100; the 180 KB budget is not met (see DECISIONS) and note routes score about 70. Media node views are not lazy loaded and there is no Lighthouse CI job.)_
- [x] **9.7 Security review.** Re-run RLS tests; review every Edge Function for input validation and auth; CSP headers; rate limits; dependency audit; confirm no service-role key in the client bundle (build-time check).
- [x] **9.8 Monitoring.** Sentry on web, collab and functions (scrub note content from events); uptime check on collab health route; structured logs. _(web, collab and functions report to Sentry only when a DSN is set, with content scrubbed; not exercised against a real Sentry project)_
- [x] **9.9 Storage limits.** Per-user storage usage shown in settings; soft limit warning (value from DECISIONS open question 4).
- [ ] **9.10 Production deploy.** Supabase project (migrations, functions, secrets, auth providers, email templates in Scraps voice), Railway collab service (single instance for v1, see DECISIONS; scaling out requires the Hocuspocus Redis extension or routing by note id, so do not add replicas without it), Vercel project with env vars; custom domain; backups confirmed. _(runbook, `railway.json` and `apps/web/vercel.json` written in `docs/DEPLOY.md`; nothing was deployed, no accounts were available)_
- [ ] **9.11 Launch content.** Privacy page, terms placeholder, sign-in page copy, app icons and social card in both themes. _(privacy and terms pages and sign-in links are done; app icons exist from Phase 6 but the social card (og:image) in both themes is not made, and the terms are a placeholder)_

## Acceptance criteria
- [ ] Lighthouse: performance >= 90 on board (mobile), accessibility 100, PWA installable.
- [ ] No axe violations on any route in either theme.
- [ ] Security checklist in PROGRESS.md signed off with evidence for each item.
- [ ] Production smoke test: sign up, capture, co-edit with a second account, go offline and back, share from Android, iOS shortcut capture, AI suggestion, export.

## Out of scope
Native apps, payments, analytics beyond error monitoring.
