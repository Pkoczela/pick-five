import Link from "next/link";
import { Badge, EmptyState, FlashMessages, Notice, PageHeading } from "@/components/ui";
import { formatDateTime, humanize } from "@/lib/format";

export type WeeksData = {
  leagueName: string;
  seasonYear: number | null;
  week: null | { id: string; number: number; seasonType: number; status: string; lockAt: string | null; testLockActive: boolean };
  games: Array<{ id: string; kickoffAt: string; away: string; home: string; homeSpread: number | null }>;
  error?: string;
  notice?: string;
};

export function WeeksView({ leagueName, seasonYear, week, games, error, notice }: WeeksData) {
  const creating = !week || week.status === "FINAL";
  const spreadsReady = games.length > 0 && games.every((game) => game.homeSpread !== null);
  return (
    <>
      <PageHeading
        eyebrow={`Commissioner · ${leagueName}`}
        title={creating ? "Create a week." : `Week ${week.number} setup`}
        action={week && !creating ? <Badge tone={week.status === "DRAFT" ? "warning" : week.status === "OPEN" ? "live" : "neutral"}>{humanize(week.status)}</Badge> : null}
      />
      <FlashMessages error={error} notice={notice} />
      {creating ? (
        <form action="/api/admin/week/create" method="post" className="panel stack-form">
          <div className="form-grid">
            <label className="field"><span>Season year</span><input name="year" type="number" defaultValue={seasonYear ?? new Date().getFullYear()} required /></label>
            <label className="field"><span>NFL week</span><input name="nflWeek" type="number" min="1" max="22" defaultValue={week ? week.number + 1 : 1} required /></label>
            <label className="field"><span>Season type</span><select name="seasonType" defaultValue="2"><option value="1">Preseason</option><option value="2">Regular season</option><option value="3">Postseason</option></select></label>
            <label className="field"><span>Entry fee ($)</span><input name="entryFeeDollars" type="number" min="0" step="1" defaultValue="10" required /></label>
          </div>
          <button type="submit" className="button button-primary">{week ? "Create next week" : "Create draft week"}</button>
        </form>
      ) : (
        <>
          {week.status === "DRAFT" ? (
            <ol className="setup-checklist" aria-label="Publish checklist">
              <li className={games.length ? "is-done" : ""}>Schedule imported</li>
              <li className={spreadsReady ? "is-done" : ""}>{games.length ? `${games.filter((game) => game.homeSpread !== null).length} of ${games.length} spreads saved` : "Spreads entered"}</li>
              <li>Choose tiebreaker &amp; publish</li>
            </ol>
          ) : null}
          <div className="section-heading">
            <h2>Official spreads</h2>
            <form action="/api/admin/schedule/import" method="post">
              <input type="hidden" name="weekId" value={week.id} />
              <input type="hidden" name="year" value={seasonYear ?? ""} />
              <input type="hidden" name="nflWeek" value={week.number} />
              <input type="hidden" name="seasonType" value={week.seasonType} />
              <button type="submit" className="button button-quiet">{games.length ? "Refresh from ESPN" : "Import schedule from ESPN"}</button>
            </form>
          </div>
          <p className="helper-text">{week.lockAt ? `Picks lock ${formatDateTime(week.lockAt)}. This deadline is frozen.` : "The deadline is frozen at publish: five minutes before the earliest kickoff."} Enter each line from the home team’s side (e.g. −3.5 if home is favored).</p>
          {games.length === 0 ? <EmptyState title="No games yet.">Import the NFL schedule to begin.</EmptyState> : (
            <form action="/api/admin/line" method="post">
              <input type="hidden" name="weekId" value={week.id} />
              <ul className="game-admin-list">
                {games.map((game) => (
                  <li className="admin-game" key={game.id}>
                    <div className="admin-matchup"><span>{formatDateTime(game.kickoffAt)}</span><strong>{game.away} <small>at</small> {game.home}</strong></div>
                    <input type="hidden" name="gameId" value={game.id} />
                    <label className="field"><span>{game.home} spread</span><input name="homeSpread" type="number" step="0.5" inputMode="decimal" defaultValue={game.homeSpread ?? ""} placeholder="−3.5" required /></label>
                  </li>
                ))}
              </ul>
              <div className="spread-save-panel">
                <div><strong>Save every spread</strong><span>All lines are saved together.</span></div>
                {week.status !== "DRAFT" ? <label className="field"><span>Reason for changes</span><input name="reason" placeholder="Required once entries exist" /></label> : null}
                <button type="submit" className="button button-primary">Save all spreads</button>
              </div>
            </form>
          )}

          {week.status === "DRAFT" && games.length > 0 ? (
            <form action="/api/admin/week/publish" method="post" className="panel stack-form action-panel">
              <input type="hidden" name="weekId" value={week.id} />
              <div><p className="eyebrow">Publish</p><h2>Open the week.</h2><p>Publishing freezes the lines and sets the deadline five minutes before the earliest kickoff. Later schedule updates won’t move it.</p></div>
              <div className="form-grid">
                <label className="field"><span>Tiebreaker game</span><select name="tiebreakerGameId" required defaultValue=""><option value="" disabled>Choose a game</option>{games.map((game) => <option value={game.id} key={game.id}>{game.away} at {game.home} · {formatDateTime(game.kickoffAt)}</option>)}</select></label>
                <label className="field"><span>Can unpaid entries win?</span><select name="unpaidEntriesEligible" defaultValue="true"><option value="true">Yes, eligible</option><option value="false">No, ineligible</option></select></label>
              </div>
              <button type="submit" className="button button-primary">Publish week</button>
            </form>
          ) : null}

          {week.status === "OPEN" && !week.testLockActive ? (
            <details className="panel disclosure">
              <summary>Test the locked pool board</summary>
              <div className="disclosure-body">
                <p>This temporarily locks all entries and reveals submitted picks to every league member. End the test to restore the real deadline and reopen editing.</p>
                <form action="/api/admin/week/test-lock" method="post" className="stack-form">
                  <input type="hidden" name="weekId" value={week.id} />
                  <input type="hidden" name="action" value="start" />
                  <label className="field"><span>Audit reason</span><input name="reason" defaultValue="Preseason locked-board test" required minLength={3} /></label>
                  <label className="check-field"><input type="checkbox" name="acknowledge" value="yes" required /><span>I confirm these are test picks. Everyone will see them.</span></label>
                  <button type="submit" className="button button-quiet">Start locked-board test</button>
                </form>
              </div>
            </details>
          ) : null}

          {week.testLockActive ? (
            <section className="panel stack-form action-panel">
              <Notice tone="info">Locked-board test is active. Players can’t edit and submitted picks are visible.</Notice>
              <Link href={`/live/${week.id}`} className="text-link">Open the shared pool board</Link>
              <form action="/api/admin/week/test-lock" method="post" className="stack-form">
                <input type="hidden" name="weekId" value={week.id} />
                <input type="hidden" name="action" value="end" />
                <label className="field"><span>Audit reason</span><input name="reason" defaultValue="Locked-board test complete" required minLength={3} /></label>
                <button type="submit" className="button button-primary">End test and reopen entries</button>
              </form>
            </section>
          ) : null}
        </>
      )}
    </>
  );
}
