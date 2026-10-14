# Design preview

The design preview runs the **real application** (same pages, components, and CSS) with a fictional league instead of Supabase. Preview-only simulation controls and sample score updates are not enabled in production.

## Live progress preview (October 11)

Choose Screen → Live board and Scenario → Live in the preview toolbar. Cards have five progress tiles, scores, quarter/clock, and labeled pale green/red live states versus strong green/red final states. Amber means currently on the spread; slate means a final push/void. Your card stays above league filters even if eliminated or excluded by a search.

The fictional feed cycles every eight seconds. Pause, advance manually, or simulate connection loss; stale snapshots remain visible. This is display-only simulation, not an NFL feed integration or automated settlement. No production database writes or changes to grading/permissions were added. Production score ingestion and passing score snapshots through the real data loader remain separate work.

Verification: 100 unit tests, lint, typecheck and optimized preview build passed. Headless Chromium checks passed at 320px, 390px and 1440px for overflow, filtering, own-card pinning, score stepping, interrupted updates, dark mode, pre-lock privacy and API isolation. Physical iPhone/Safari review remains recommended.

## Audit fixes (October 11)

- Payment screens use recorded expected/received amounts, including partial and waived statuses. Dashboard jackpots and commissioner payout defaults read `week_calculated_contribution`; entry screens explain assessed catch-up fees.
- Preview scenario changes and Reset remount the pick form. Saving and toggling failure simulation preserve the current draft and save feedback. Pending sample saves cannot undo a reset.
- Historical boards and season totals share the same per-week sample picks, matching the recap winner (or no winner).
- Rotated invite codes are displayed only in the league that owns the cookie.

The production loaders depend on the existing catch-up-fee RPC introduced on `main` by the catch-up-fee work. Do not deploy this branch against an older database lacking that RPC; failures surface instead of silently displaying base-only totals. Preview mode remains sample-only and does not require the RPC.

Verification: 118 tests, lint, typecheck, optimized build, and headless Chromium checks for scenario/reset, save failure/retry, historical winners, payment totals and mobile overflow. No production Supabase access was used. Real NFL feed integration and physical iPhone/Safari review remain separate.

## Main integration (October 13)

Merged `origin/main` at `b42d48a` into the redesign branch, not the reverse. Resolved the seven overlapping files by retaining the redesigned page/loader structure and design tokens while preserving main's behavior:

- Catch-up-fee domain logic, both migrations, and financial tests match main unchanged. Migrations were incorporated into Git only; none were applied to a database.
- History expands in place with final results, top score, finalized time, winner/payout, tiebreaker prediction/actual/error, and the current player's card first.
- The archive and full finalized-week board share the same recorded results. Both historical and locked-week spreads use the submitted official line rather than the current line.
- Payment and jackpot displays continue to use assessed amounts and the authoritative contribution RPC.

Verification: 128 tests, lint, typecheck and optimized preview build passed. Headless Chromium checks at 320/390/1440px passed for keyboard history expansion, own-first ordering, tiebreaker/payout details, full-board navigation, no horizontal overflow, sample-only API isolation, and the existing pick/reset/live-board regression suite. The preview still simulates live scores; this merge does not add a production NFL feed. Main and production data were not modified.

## Running it

```bash
PICK_FIVE_PREVIEW=1 npm run dev -- --port 3106
```

Every Vercel Preview deployment runs in this mode automatically. Production (`VERCEL_ENV=production`) never does, even with the flag set.

There is no login in the preview: every page behaves as if the sample player Alex Morgan is signed in. Submitting the log in, join, or create-league form takes you into the sample league.

The bar at the top of every page controls the sample league:

- **Screen**: jump to any page, including the logged-out landing and auth pages.
- **Scenario**: Open, Submitted, Locked, Live, Final, Empty (new season, no data), Error (renders the real error boundary), Loading (holds every page in the real loading state).
- **Role**: Commissioner or Player. Players are redirected away from commissioner pages exactly as in production.
- **Fail saves**: makes the next pick submission fail, to review recovery.
- **Reset**: clears all preview state.

Picks you submit are kept in a browser cookie and flow through the dashboard, live board, and commissioner entry list. Commissioner forms (payments, spreads, publish, etc.) post to `/api/*`; the preview intercepts them and explains that server actions are disabled.

## How it works

Each page is split into a **loader** and a **view**:

```
app/<route>/page.tsx          picks a data source, renders the view
lib/data/<route>.ts           production loader (Supabase)
lib/preview/sample.ts         preview loader (fictional league)
components/views/<route>.tsx  presentation only: plain props in, markup out
```

To change the design, edit the view or `app/globals.css`, check it in the preview, and merge. To add data a view needs, add it to the view's props type: TypeScript then requires both the production loader and the sample to supply it.

## Safety

- `lib/preview-mode.ts` decides preview mode from the environment only.
- In preview mode the proxy returns 403 for every `/api/*` request and every non-GET/HEAD request, and both Supabase client factories throw before reading credentials (`tests/preview-safety.test.ts`).
- `requireLeagueContext` returns the sample context in preview mode, so no page can fall through to a database query.

## Theme

Colours are tokens on `:root` in `app/globals.css`; dark mode only redefines tokens. Players choose Match device / Light / Dark under **More → Appearance**; the choice is stored in the `pf_theme` cookie so the server renders the right theme on first paint.
