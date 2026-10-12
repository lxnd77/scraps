# Deploying scraps. (runbook)

Phase 9.10. Nothing here has been run against hosted services: this was written without access to
any Supabase, Railway, Vercel, Sentry or DNS account. Follow it top to bottom, tick as you go, and
fix this file where reality differs.

Topology: **Vercel** (web) → **Supabase** (Postgres, Auth, Storage, Edge Functions) ← **Railway**
(collab, one instance only, see DECISIONS: scaling out needs the Hocuspocus Redis extension).

No custom domain is assumed. The web app lives on its Vercel address, `https://<project>.vercel.app`,
and the collab server on the address Railway generates, `https://<service>.up.railway.app`. Both are
HTTPS with working WebSockets, which is all the app needs. A custom domain can be added later by
repeating the steps marked **(origin)** with the new address.

Two placeholders are used below:

- `WEB_ORIGIN`: `https://<project>.vercel.app`, the project's **production** domain (Vercel →
  Project → Settings → Domains). Pick a project name you like first: the address is derived from it.
  Use this stable address, not a per-deployment URL such as `<project>-<hash>-<team>.vercel.app`.
- `COLLAB_ORIGIN`: `https://<service>.up.railway.app` (Railway → Service → Settings → Networking →
  Generate Domain). Clients connect with `wss://` to the same host.

## 0. Before you start

- [ ] A Vercel project created (name it first, so `WEB_ORIGIN` is known), and a Railway service with a generated domain (so `COLLAB_ORIGIN` is known). Order matters: both addresses are needed by the other services' settings, so create the two projects before filling in variables.
- [ ] Accounts: Supabase, Railway, Vercel, Sentry (optional), Groq and Anthropic (for transcripts and suggestions).
- [ ] Decide the owner-visible answers still open in DECISIONS: free tier (storage limit is a 500 MB soft warning today) and languages.

## 1. Supabase project

1. Create the project. Region close to your users and to Railway.
2. Link and push the schema from this repo:
   ```bash
   pnpm exec supabase link --project-ref <ref>
   pnpm exec supabase db push        # applies supabase/migrations in order
   ```
3. Extensions (Dashboard → Database → Extensions): enable **pg_net** and **pg_cron**.
4. Seed the function-hook config (SQL editor). `internal_secret` must equal the secret you give the
   collab server and the functions below:
   ```sql
   insert into public.app_config (key, value) values
     ('functions_url', 'https://<ref>.supabase.co/functions/v1'),
     ('internal_secret', '<long random string>'),
     ('functions_apikey', '<the project publishable (anon) key>');
   ```
   The daily trash purge (`scraps-purge-trash`, 03:10 UTC) is scheduled by migration
   `20261012100000_phase9_trash.sql` when pg_cron is available; confirm with
   `select * from cron.job;`.
5. Auth → URL configuration **(origin)**: **Site URL** = `WEB_ORIGIN`; add `WEB_ORIGIN/**` to Redirect URLs.
   Vercel preview deployments get their own addresses, and a magic link sent from one lands on the
   Site URL, so sign-in is only expected to work on the production address. If you do want it on
   previews, add `https://*-<team>.vercel.app/**` to Redirect URLs as well.
6. Auth → Providers: Email on (magic link). Google on with a client id and secret (needs a Google Cloud OAuth client; authorised redirect `https://<ref>.supabase.co/auth/v1/callback`).
7. Auth → Email templates: paste **both** `supabase/templates/magic-link.html` (into "Magic Link") and `supabase/templates/confirm-signup.html` (into "Confirm signup"). A brand new address is sent the Confirm signup email, so with only the first pasted a new user gets Supabase's default link (`…supabase.co/auth/v1/verify?token=pkce_…`), which this app does not handle. Both link to `{{ .SiteURL }}/auth/confirm`. Without a custom sender domain, mail goes out from Supabase's shared sender, which is rate limited (a few messages an hour) and often lands in spam. Fine for testing with a handful of people; set up custom SMTP (Auth → SMTP settings) before inviting more.
8. Storage: confirm the `media` and `exports` buckets exist and are **private** (the migrations create them).
9. Edge Function secrets:
   ```bash
   pnpm exec supabase secrets set \
     INTERNAL_SECRET=<same long string> \
     COLLAB_INTERNAL_URL=<COLLAB_ORIGIN> \
     APP_URL=<WEB_ORIGIN> \
     ANTHROPIC_API_KEY=<key> \
     TRANSCRIPTION_PROVIDER=groq \
     TRANSCRIPTION_API_KEY=<groq key> \
     SENTRY_DSN=<optional>
   ```
10. Deploy the functions (all use `verify_jwt = false`; each checks its own caller):
    ```bash
    pnpm exec supabase functions deploy capture unfurl-link transcribe-audio ai-sort purge-trash delete-account
    ```
11. Backups: Dashboard → Database → Backups. Confirm daily backups are on (and point-in-time recovery if the plan has it). Account deletion promises removal from backups within 30 days.
12. One-off: transcribe any memo recorded before this was deployed:
    ```bash
    curl -X POST https://<ref>.supabase.co/functions/v1/transcribe-audio \
      -H "apikey: <publishable key>" -H "x-internal-secret: <secret>" \
      -H "content-type: application/json" -d '{"backfill": true}'
    ```

## 2. Railway: collab server (single instance)

- Service from this repo, config in `railway.json` (build `pnpm --filter @scraps/collab build`, start `node apps/collab/dist/index.js`, health check `/health`).
- Replicas: **1**. Do not add replicas.
- Variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `INTERNAL_SECRET`, `ALLOWED_ORIGINS=<WEB_ORIGIN>` **(origin)**, `SENTRY_DSN` (optional), `APP_ENV=production`. `PORT` is set by Railway.
  `ALLOWED_ORIGINS` is an exact match on scheme, host and port: no trailing slash, and add further origins (a custom domain later, a preview) comma separated.
- Networking: use the generated `*.up.railway.app` domain. Railway terminates TLS and supports WebSockets on it.
- Uptime check (any monitor): `GET <COLLAB_ORIGIN>/health` → 200 `{"status":"ok"}`. Alert after 2 failures a minute apart.

## 3. Vercel: web

- Project root `apps/web`; config in `vercel.json` (it runs the build from the monorepo root).
- Environment variables (Production):
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable key),
  `NEXT_PUBLIC_COLLAB_URL=wss://<service>.up.railway.app` **(origin)**, `NEXT_PUBLIC_SENTRY_DSN` (optional),
  `NEXT_PUBLIC_APP_ENV=production`, `NEXT_PUBLIC_SHORTCUT_URL` (once the iOS shortcut is hosted).
- **Never** put the service role key in Vercel. `pnpm check:bundle` (run in CI after a build) fails if it ends up in the client bundle.
- Domain: nothing to configure; the project's `*.vercel.app` address is `WEB_ORIGIN`. HSTS and the CSP come from `next.config.ts` and need no setup, and the CSP's connect list is built from the two `NEXT_PUBLIC_*` URLs above, so set those before the first production build (they are read at build time, so changing them means a redeploy).
- `NEXT_PUBLIC_*` variables are inlined into the browser bundle at build time. Anything you change here needs a new deployment to take effect.

## 4. After the first deploy

- [ ] `PERF_BASE_URL=<WEB_ORIGIN> pnpm perf` (the script signs up a throwaway user, so Mailpit is not used in production: sign up once by hand and skip this step if your Supabase project only mails real addresses): board performance ≥ 90, accessibility 100.
- [ ] Lighthouse PWA: installable on Chrome Android and desktop.
- [ ] Sentry: throw a test error from a signed-in session; confirm it arrives with no note text.
- [ ] Production smoke test (below).

## 5. Production smoke test

Run with two accounts (A and B) on real devices where it says so.

1. [ ] A: sign up with a magic link (email arrives in the Scraps voice, link lands signed in), finish onboarding.
2. [ ] A: capture a text scrap, a list, a picture and a link. All appear on the board.
3. [ ] A: invite B as editor; B joins. Both edit one note; carets and text sync.
4. [ ] A: go offline (airplane mode), edit and capture, go back online. Everything syncs once.
5. [ ] Android Chrome (installed PWA): share a URL from another app to scraps.
6. [ ] iPhone: use the "Send to Scraps" shortcut with a capture token from settings.
7. [ ] A: turn suggestions on (settings), capture "book train tickets for goa trip": a suggestion toast appears; yes files it.
8. [ ] A: record a 20 second voice memo: transcript appears within 30 s; search finds a word from it.
9. [ ] A: delete a scrap, restore it from the trash; delete another and "delete forever".
10. [ ] A: settings → export everything: the zip downloads and opens with one markdown file per scrap.
11. [ ] B: settings → delete account (as the non-owner): signs out, A's space is unaffected.
12. [ ] Check Sentry, Railway logs and the Supabase function logs for errors from the above.

## 6. Rollback

- Web: Vercel → Deployments → promote the previous one.
- Collab: Railway → redeploy the previous deployment.
- Database: migrations are forward only; ship a new migration to fix forward. Restore from a backup only for data loss.
- Functions: redeploy the previous commit's functions with `supabase functions deploy`.
