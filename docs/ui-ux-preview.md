# Design preview

The design preview runs the **real application** (same pages, components, and CSS) with a fictional league instead of Supabase. Whatever you see in the preview is exactly what ships when the branch merges.

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
