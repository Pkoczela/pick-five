# Pick Five UI/UX prototype

Branch: `codex/ui-ux-redesign`. Do not merge or deploy to production without approval.

## Direction and audit

Preserve the Pick Five wordmark and forest-green / cream / orange identity. Add consistent design tokens, high-contrast actions, restrained lime highlights, unified cards, clear status labels, and reusable headings, notices and result cards.

The original screens have inconsistent page-level navigation, dense commissioner tables, limited submission guidance, and inconsistent form/status treatment. Mobile users need larger targets, persistent navigation, a visible deadline and submission summary, and easier historical-week browsing. The original stacked matchup choices consume too much phone screen space: the prototype puts the teams side by side below 761px and keeps desktop choices stacked.

## Safety architecture

- Every Vercel Preview deployment automatically uses fictional data. Production cannot be switched into sample mode with the local flag.
- Proxy rewrites player, auth and commissioner pages to the sample application. API requests and non-GET/HEAD requests receive 403.
- Both Supabase client factories are additionally blocked at environment resolution in preview mode. No production credentials are needed for local testing.
- Sample saves, payment state, publishing and audit events stay in sessionStorage in the current browser tab. Reset clears only the prototype's keys.
- No database migrations, game-rule changes, auth changes or permission changes are part of this work. The existing production endpoints remain intact.

Local: `PICK_FIVE_PREVIEW=1 npm run dev -- --port 3106`.

## What to review

Start with This week, select five teams, enter a tiebreaker, submit, and return to the dashboard. Use the failed-save checkbox to explore recovery. Change View to Submitted, Locked, Live, Final, Empty, Error or Loading. Use More → Commissioner on mobile to explore setup, entries, payments, results, players and audit. History has older/newer controls and a rollover example. Switch Role to Player to see the player-only view.

This is a visual/interaction prototype, not a replacement backend: some commissioner forms demonstrate validation and confirmation without applying changes to all related sample fixtures. Sample season totals and historical matchups are illustrative. Real authentication, provider imports, settlement, and database authorization require a separate test environment before production integration. No production write testing was performed.

## Verification

- ESLint, TypeScript and optimized Next build pass.
- 78 automated tests pass, including existing rule/permission tests and 26 preview-isolation tests.
- Browser checks: phone and desktop matchup geometry, five-pick limit, required tiebreaker, failed save/retry, saved-state navigation, historical paging/rollover, sample publish confirmation, payment updates, audit persistence, and player access boundary.
- Viewports include 320px, 390px and 1440px. These are browser viewport checks, not physical iPhone/Safari certification.

Keep feedback and subsequent design iterations on this branch. A production rollout needs explicit approval and integration/QA against a separate test Supabase environment.
