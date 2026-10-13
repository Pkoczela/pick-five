import Link from "next/link";
import { EmptyState, PageHeading } from "@/components/ui";
import { EntryCard, type BoardEntry } from "@/components/pool-board";
import { formatDateTime, formatMoney } from "@/lib/format";

export type HistoryData = {
  leagueName: string;
  weeks: Array<{ id: string; season: number; number: number; winners: string[]; payoutCents: number; rolloverCents: number; finalizedAt: string | null; entries: BoardEntry[] }>;
};

export function HistoryView({ leagueName, weeks }: HistoryData) {
  return (
    <>
      <PageHeading eyebrow={`Archive · ${leagueName}`} title="Weeks worth revisiting." description="Open a finished week to revisit every pick, tiebreaker, and payout. Your entry appears first." />
      {weeks.length ? (
        <ol className="history-list">
          {weeks.map((week) => (
            <li key={week.id}>
              <details className="history-card">
                <summary>
                <span className="card-kicker">{week.season} · Week {week.number}</span>
                <h2>{week.winners.length ? week.winners.join(" & ") : "No 5–0 winner"}</h2>
                <p>Payout {formatMoney(week.payoutCents)} · Rollover {formatMoney(week.rolloverCents)}</p>
                <p>Top score {week.entries.length ? `${Math.max(...week.entries.map(entry => entry.correct))} / 5` : "—"}</p>
                <span className="history-toggle">View week <span aria-hidden="true">＋</span></span>
                </summary>
                <section className="history-week-details" aria-label={`Week ${week.number} results`}>
                  <div className="section-heading"><h3>{week.entries.length} entries</h3><Link className="text-link" href={`/live/${week.id}`}>Full week board →</Link></div>
                  <p className="helper-text">Finalized {week.finalizedAt ? formatDateTime(week.finalizedAt) : "—"}</p>
                  {week.entries.length ? <div className="pool-grid">{week.entries.map(entry => <EntryCard key={entry.id} entry={entry} />)}</div> : <EmptyState title="No finalized entries available." />}
                </section>
              </details>
            </li>
          ))}
        </ol>
      ) : <EmptyState title="No finished weeks yet.">Weeks appear here once the commissioner finalizes them.</EmptyState>}
    </>
  );
}
