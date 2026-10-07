import { EmptyState, PageHeading, Stat } from "@/components/ui";
import type { StandingsRow } from "@/lib/domain/standings";
import { formatMoney } from "@/lib/format";

export type StandingsData = {
  leagueName: string;
  ownMemberId: string;
  rows: StandingsRow[];
  summary: { weeksCompleted: number; perfectWeeks: number; paidOutCents: number };
};

export function StandingsView({ leagueName, ownMemberId, rows, summary }: StandingsData) {
  return (
    <>
      <PageHeading eyebrow={`Season · ${leagueName}`} title="The season so far." description="Every correct pick counts. Weekly jackpots go to a perfect five." />
      <div className="stats-strip">
        <Stat label="Weeks final" value={summary.weeksCompleted} />
        <Stat label="5–0 weeks" value={summary.perfectWeeks} />
        <Stat label="Paid out" value={formatMoney(summary.paidOutCents)} />
      </div>
      {summary.weeksCompleted === 0 ? <EmptyState title="No finished weeks yet.">Standings fill in once the first week is finalized.</EmptyState> : (
        <ol className="leaderboard" aria-label="League standings">
          <li className="leader-row leader-head" aria-hidden="true"><span>Player</span><span>Correct</span><span>Per week</span><span>5–0 wins</span><span>Won</span></li>
          {rows.map((row) => (
            <li className={`leader-row ${row.id === ownMemberId ? "is-you" : ""}`} key={row.id}>
              <div className="rank-name"><span className="rank-number">{row.rank}</span><strong>{row.name}</strong>{row.id === ownMemberId ? <span className="you-tag">You</span> : null}</div>
              <span data-label="Correct"><strong>{row.correct}</strong></span>
              <span data-label="Per week">{row.weeks ? (row.correct / row.weeks).toFixed(1) : "—"}</span>
              <span data-label="5–0 wins">{row.wins}</span>
              <span data-label="Won">{formatMoney(row.winningsCents)}</span>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
