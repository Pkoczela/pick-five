import { requireAdminContext } from "@/lib/auth/context";
import { createUserClient } from "@/lib/supabase/server";

type GameRow = {
  id: string;
  kickoff_at: string;
  status: string;
  home_team: { abbreviation: string; display_name: string } | null;
  away_team: { abbreviation: string; display_name: string } | null;
  official_lines: Array<{ id: string; home_spread: number; is_current: boolean }>;
};

export default async function AdminWeeksPage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const context = await requireAdminContext();
  const params = await searchParams;
  const supabase = await createUserClient();
  const { data: seasons } = await supabase.from("seasons").select("id, year").eq("league_id", context.leagueId).order("year", { ascending: false }).limit(1);
  const season = seasons?.[0];
  const { data: weeks } = season ? await supabase.from("weeks").select("id, nfl_week, season_type, status, lock_at, unpaid_entries_eligible, test_lock_active, test_original_lock_at").eq("season_id", season.id).order("nfl_week", { ascending: false }).limit(1) : { data: null };
  const week = weeks?.[0];
  const { data: rawGames } = week ? await supabase
    .from("games")
    .select("id, kickoff_at, status, home_team:teams!games_home_team_id_fkey(abbreviation, display_name), away_team:teams!games_away_team_id_fkey(abbreviation, display_name), official_lines(id, home_spread, is_current)")
    .eq("week_id", week.id)
    .order("kickoff_at") : { data: null };
  const games = (rawGames ?? []) as unknown as GameRow[];

  return (
    <main className="standalone-page">
      <a href="/admin" className="back-link">← Commissioner</a>
      <p className="eyebrow">WEEK SETUP · {context.leagueName.toUpperCase()}</p>
      <h1>{week ? `Week ${week.nfl_week}` : "Create a week."}</h1>
      {params.error ? <p className="form-message form-error">{params.error}</p> : null}
      {params.notice ? <p className="form-message form-notice">{params.notice}</p> : null}

      {!week || week.status === "FINAL" ? (
        <form action="/api/admin/week/create" method="post" className="admin-form panel">
          <div className="form-grid">
            <label className="field"><span>Season year</span><input name="year" type="number" defaultValue={new Date().getFullYear()} required /></label>
            <label className="field"><span>NFL week</span><input name="nflWeek" type="number" min="1" max="22" defaultValue={week ? week.nfl_week + 1 : 1} required /></label>
            <label className="field"><span>Season type</span><select name="seasonType" defaultValue="2"><option value="1">Preseason</option><option value="2">Regular season</option><option value="3">Postseason</option></select></label>
            <label className="field"><span>Entry fee</span><input name="entryFeeDollars" type="number" min="0" step="1" defaultValue="10" required /></label>
          </div>
          <button type="submit" className="button button-primary">{week ? "Create next week" : "Create draft week"}</button>
        </form>
      ) : (
        <>
          <div className="week-toolbar">
            <span className="status-pill">{week.status}</span>
            {week.lock_at ? <span>Frozen lock: {formatDate(week.lock_at)}</span> : <span>Lock freezes at publish</span>}
            <form action="/api/admin/schedule/import" method="post">
              <input type="hidden" name="weekId" value={week.id} />
              <input type="hidden" name="year" value={season?.year} />
              <input type="hidden" name="nflWeek" value={week.nfl_week} />
              <input type="hidden" name="seasonType" value={week.season_type} />
              <button type="submit" className="button button-quiet">Import / refresh ESPN</button>
            </form>
          </div>

          <form action="/api/admin/line" method="post" className="bulk-line-form">
            <input type="hidden" name="weekId" value={week.id} />
            <section className="game-admin-list">
            {games.length === 0 ? <div className="coming-panel">Import the NFL schedule to begin.</div> : games.map((game) => {
              const line = game.official_lines.find((candidate) => candidate.is_current);
              return (
                <article className="admin-game" key={game.id}>
                  <div className="admin-matchup">
                    <span>{formatDate(game.kickoff_at)}</span>
                    <strong>{game.away_team?.abbreviation} <small>at</small> {game.home_team?.abbreviation}</strong>
                  </div>
                  <div className="line-form">
                    <input type="hidden" name="gameId" value={game.id} />
                    <label className="field"><span>Home spread</span><input name="homeSpread" type="number" step="0.5" defaultValue={line?.home_spread ?? ""} placeholder="−3.5" required /></label>
                  </div>
                </article>
              );
            })}
            </section>
            {games.length > 0 ? <div className="spread-save-panel">
              <div><strong>Save every spread</strong><span>All edited lines are saved together.</span></div>
              {week.status !== "DRAFT" ? <label className="field"><span>Reason for changes</span><input name="reason" placeholder="Required after entries exist" /></label> : null}
              <button type="submit" className="button button-primary">Save all spreads</button>
            </div> : null}
          </form>

          {week.status === "DRAFT" && games.length > 0 ? (
            <form action="/api/admin/week/publish" method="post" className="publish-panel">
              <input type="hidden" name="weekId" value={week.id} />
              <div><p className="eyebrow">PUBLISH WEEK</p><h2>Freeze the lines and deadline.</h2><p>The deadline becomes five minutes before the earliest imported kickoff and will not move with later schedule updates.</p></div>
              <label className="field"><span>Tiebreaker game</span><select name="tiebreakerGameId" required defaultValue=""><option value="" disabled>Choose a game</option>{games.map((game) => <option value={game.id} key={game.id}>{game.away_team?.abbreviation} at {game.home_team?.abbreviation} · {formatDate(game.kickoff_at)}</option>)}</select></label>
              <label className="field"><span>Are unpaid entries eligible?</span><select name="unpaidEntriesEligible" defaultValue="true"><option value="true">Yes, eligible</option><option value="false">No, ineligible</option></select></label>
              <button type="submit" className="button button-primary">Publish week</button>
            </form>
          ) : null}

          {week.status === "OPEN" && !week.test_lock_active ? (
            <section className="lock-test-panel">
              <div>
                <p className="eyebrow">PRESEASON TEST</p>
                <h2>Test the locked pool board.</h2>
                <p>This temporarily locks all entries and reveals submitted picks to every league member. End the test to restore the real deadline and reopen editing.</p>
              </div>
              <form action="/api/admin/week/test-lock" method="post">
                <input type="hidden" name="weekId" value={week.id} />
                <input type="hidden" name="action" value="start" />
                <label className="field"><span>Audit reason</span><input name="reason" defaultValue="Preseason locked-board test" required minLength={3} /></label>
                <label className="test-acknowledgment"><input type="checkbox" name="acknowledge" value="yes" required /> <span>I confirm these are test picks. Everyone will see them.</span></label>
                <button type="submit" className="button button-primary">Start locked-board test</button>
              </form>
            </section>
          ) : null}

          {week.test_lock_active ? (
            <section className="lock-test-panel lock-test-active">
              <div>
                <p className="eyebrow">TEST ACTIVE</p>
                <h2>Submitted picks are visible.</h2>
                <p>Players cannot edit while this test is active. Check the shared board, then end the test before the original deadline.</p>
                <a href={`/live/${week.id}`} className="text-link">Open shared pool board →</a>
              </div>
              <form action="/api/admin/week/test-lock" method="post">
                <input type="hidden" name="weekId" value={week.id} />
                <input type="hidden" name="action" value="end" />
                <label className="field"><span>Audit reason</span><input name="reason" defaultValue="Locked-board test complete" required minLength={3} /></label>
                <button type="submit" className="button button-primary">End test and reopen entries</button>
              </form>
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York", timeZoneName: "short" }).format(new Date(value));
}
