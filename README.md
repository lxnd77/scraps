# scraps. build kit

Everything Claude Code needs to build Scraps v1: rules, spec, design tokens, design reference and a 10-phase plan.

## Start

1. Create an empty GitHub repo and clone it.
2. Copy the contents of this folder into the repo root (so `CLAUDE.md` sits at the top).
3. Open Claude Code in the repo and say:

   > Read CLAUDE.md and docs/PLAN.md, then start Phase 0. Plan first, then build.

4. At the end of each phase Claude Code stops with a summary. Review it, then say "start Phase N".

## Before Phase 8
Answer open question 2 in `docs/DECISIONS.md` (transcription provider). The other open questions can be answered any time before Phase 9.

## Accounts you will need
- GitHub (repo and CI)
- Supabase (project for staging and production; local dev uses the Supabase CLI and Docker)
- Vercel (web app)
- Railway (collab server)
- Anthropic API key (AI suggestions)
- Speech-to-text provider key (voice transcripts)
- Google Cloud OAuth client (Google sign-in)
- Sentry (Phase 9)

## What's inside

```
CLAUDE.md                 rules Claude Code reads every session
docs/SPEC.md              product and design spec
docs/tokens.css           design tokens for daylight and after midnight
docs/PLAN.md              phase overview and risks
docs/phases/              one file per phase with tasks, acceptance criteria, tests
docs/DECISIONS.md         confirmed stack, defaults, open questions
docs/design-reference/    source of the 10 design artboards
```
