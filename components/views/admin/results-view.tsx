import Link from "next/link";
import { Badge, EmptyState, FlashMessages, Notice, PageHeading } from "@/components/ui";
import { formatMoney, humanize } from "@/lib/format";

export type ResultsData = {
  seasonYear: number | null;
  week: null | {
    id: string; number: number; seasonType: number; status: string; testLockActive: boolean;
    payoutCents: number; rolloverOutCents: number; jackpotCents: number;
  };
  laterReopenedWeeks: number;
  games: Array<{ id: string; away: string; home: string; awayScore: number | null; homeScore: number | null; status: string; ats: string | null }>;
  tied: Array<{ memberId: string; name: string; tiebreakerError: number | null }>;
  simulationEntries: Array<{ id: string; name: string }>;
  error?: string;
  notice?: string;
};

export function ResultsView({ seasonYear, week, laterReopenedWeeks, games, tied, simulationEntries, error, notice }: ResultsData) {
  if (!week) {
    return (
      <>
        <PageHeading eyebrow="Commissioner · Results" title="Review results." />
        <FlashMessages error={error} notice={notice} />
        <EmptyState title="No published week.">Results appear once a week has been published.</EmptyState>
      </>
    );
  }
  const decided = games.filter((game) => game.ats).length;
  return (
    <>
      <PageHeading
        eyebrow={`Commissioner · Week ${week.number} · Results`}
        title={week.status === "FINAL" ? "That’s a wrap." : "Review the final whistle."}
        description={`${decided} of ${games.length} games decided against the spread.`}
        action={<Badge tone={week.status === "FINAL" ? "success" : "warning"}>{humanize(week.status)}</Badge>}
      />
      <FlashMessages error={error} notice={notice} />
      {laterReopenedWeeks > 0 ? <Notice tone="info">Correction cascade: re-finalize Week {week.number} first. {laterReopenedWeeks} later {laterReopenedWeeks === 1 ? "week remains" : "weeks remain"}.</Notice> : null}
      {week.testLockActive ? (
        <section className="panel stack-form action-panel is-test">
          <div><p className="eyebrow">Full-week simulation</p><h2>Test data is active.</h2><p>ESPN updates are isolated from these simulated scores. Reset when testing is complete to restore the real deadline, game states, picks, and finances.</p></div>
          <Link href={`/live/${week.id}`} className="text-link">Open the player-facing live board</Link>
          <form action="/api/admin/week/simulation-reset" method="post" className="inline-form">
            <input type="hidden" name="weekId" value={week.id} />
            <label className="field"><span>Reset reason</span><input name="reason" defaultValue="Full-week production rehearsal complete" required minLength={3} /></label>
            <button className="button button-quiet" type="submit">Reset all test data</button>
          </form>
        </section>
      ) : null}
      <div className="section-heading">
        <h2>Games</h2>
        <form action="/api/admin/scores/refresh" method="post">
          <input type="hidden" name="weekId" value={week.id} />
          <input type="hidden" name="year" value={seasonYear ?? ""} />
          <input type="hidden" name="nflWeek" value={week.number} />
          <input type="hidden" name="seasonType" value={week.seasonType} />
          <button className="button button-quiet" type="submit">Refresh ESPN scores</button>
        </form>
      </div>
      <ul className="management-list">
        {games.map((game) => (
          <li className="management-row result-game" key={game.id}>
            <div>
              <strong>{game.away} <span className="muted">at</span> {game.home}</strong>
              <p className="score-display">{game.awayScore ?? "–"}<span aria-hidden="true">:</span><span className="sr-only"> to </span>{game.homeScore ?? "–"}</p>
            </div>
            <div className="result-meta"><Badge tone={game.ats ? "success" : "neutral"}>{game.ats ? `ATS: ${atsLabel(game)}` : humanize(game.status)}</Badge></div>
            <details className="disclosure">
              <summary>Override<span className="sr-only"> {game.away} at {game.home}</span></summary>
              <form action="/api/admin/game/override" method="post" className="disclosure-body form-grid">
                <input type="hidden" name="gameId" value={game.id} />
                <label className="field"><span>{game.away} score</span><input name="awayScore" type="number" min="0" inputMode="numeric" defaultValue={game.awayScore ?? ""} /></label>
                <label className="field"><span>{game.home} score</span><input name="homeScore" type="number" min="0" inputMode="numeric" defaultValue={game.homeScore ?? ""} /></label>
                <label className="field"><span>ATS result</span><select name="atsResult" defaultValue={game.ats ?? "HOME"}><option value="HOME">{game.home} covers</option><option value="AWAY">{game.away} covers</option><option value="PUSH">Push</option><option value="VOID">Void</option></select></label>
                <label className="field"><span>Reason</span><input name="reason" required /></label>
                <button className="button button-quiet" type="submit">Apply override</button>
              </form>
            </details>
          </li>
        ))}
      </ul>

      {week.testLockActive && week.status !== "FINAL" && week.status !== "TIE_REQUIRES_COMMISSIONER" ? (
        <form action="/api/admin/week/simulate" method="post" className="panel stack-form action-panel is-test">
          <input type="hidden" name="weekId" value={week.id} />
          <input type="hidden" name="reason" value="Commissioner full-week simulation" />
          <div><p className="eyebrow">Scenario lab</p><h2>Simulate the final whistle.</h2><p>Apply final scores to every game at once. Re-run scenarios, inspect the live board, and finalize normally.</p></div>
          <div className="form-grid">
            <label className="field"><span>Outcome</span><select name="scenario" defaultValue="FIVE_ZERO"><option value="FIVE_ZERO">Selected player goes 5–0</option><option value="NO_WINNER">Nobody goes 5–0</option></select></label>
            <label className="field"><span>5–0 player</span><select name="targetEntryId" defaultValue={simulationEntries[0]?.id}>{simulationEntries.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
            <label className="field"><span>Simulated tiebreaker total</span><input name="mnfTotal" type="number" min="0" max="200" defaultValue="47" required /></label>
          </div>
          <button className="button button-primary" type="submit">Apply simulated results</button>
        </form>
      ) : null}

      {week.status === "TIE_REQUIRES_COMMISSIONER" ? (
        <form action="/api/admin/week/manual-resolve" method="post" className="panel stack-form action-panel">
          <input type="hidden" name="weekId" value={week.id} />
          <div><p className="eyebrow">Exact tie</p><h2>Allocate {formatMoney(week.jackpotCents)}</h2><p>Enter the amount paid to each tied 5–0 player. Allocations must total the jackpot.</p></div>
          {tied.map((result) => <label className="field" key={result.memberId}><span>{result.name} · off by {result.tiebreakerError}</span><input name={`allocation_${result.memberId}`} type="number" min="0" step="0.01" inputMode="decimal" defaultValue={(week.jackpotCents / tied.length / 100).toFixed(2)} /></label>)}
          <label className="field"><span>Resolution note</span><input name="note" required placeholder="Explain the winner or split" /></label>
          <button className="button button-primary" type="submit">Finalize resolution</button>
        </form>
      ) : week.status !== "FINAL" ? (
        <form action="/api/admin/week/finalize" method="post" className="panel stack-form action-panel">
          <input type="hidden" name="weekId" value={week.id} />
          <div><p className="eyebrow">Final review</p><h2>Finalize winner and jackpot</h2><p>The server rechecks every result, payment eligibility, tiebreaker, contribution, payout, and rollover before saving.</p></div>
          {decided < games.length ? <Notice tone="info">{games.length - decided} {games.length - decided === 1 ? "game is" : "games are"} still undecided.</Notice> : null}
          <button className="button button-primary" type="submit">Finalize week</button>
        </form>
      ) : (
        <section className="panel stack-form action-panel">
          <div><p className="eyebrow">Week finalized</p><h2>Payout {formatMoney(week.payoutCents)} · Rollover {formatMoney(week.rolloverOutCents)}</h2></div>
          <details className="disclosure danger-zone">
            <summary>Reopen for a correction</summary>
            <form action="/api/admin/week/reopen" method="post" className="disclosure-body stack-form">
              <input type="hidden" name="weekId" value={week.id} />
              <p>Reopening also reopens later weeks whose rollover depends on this one. Re-finalize them in order.</p>
              <label className="field"><span>Correction reason</span><input name="reason" required placeholder="Describe the score, line, or result correction" /></label>
              <button className="button button-danger" type="submit">Reopen week and later history</button>
            </form>
          </details>
        </section>
      )}
    </>
  );
}

function atsLabel(game: { ats: string | null; home: string; away: string }) {
  return game.ats === "HOME" ? game.home : game.ats === "AWAY" ? game.away : humanize(game.ats ?? "");
}
