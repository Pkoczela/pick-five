import Link from "next/link";
import { EmptyState, Icon, PageHeading } from "@/components/ui";
import { formatMoney } from "@/lib/format";

export type HistoryData = {
  leagueName: string;
  weeks: Array<{ id: string; season: number; number: number; winners: string[]; payoutCents: number; rolloverCents: number }>;
};

export function HistoryView({ leagueName, weeks }: HistoryData) {
  return (
    <>
      <PageHeading eyebrow={`Archive · ${leagueName}`} title="Weeks worth revisiting." description="Every finalized week, its winners, and where the jackpot went." />
      {weeks.length ? (
        <ol className="history-list">
          {weeks.map((week) => (
            <li key={week.id}>
              <Link className="history-card" href={`/live/${week.id}`}>
                <span className="card-kicker">{week.season} · Week {week.number}</span>
                <h2>{week.winners.length ? week.winners.join(" & ") : "No 5–0 winner"}</h2>
                <p>{week.winners.length ? `Won ${formatMoney(week.payoutCents)}` : `${formatMoney(week.rolloverCents)} rolled over`}</p>
                <span className="history-arrow" aria-hidden="true"><Icon name="arrow" /></span>
              </Link>
            </li>
          ))}
        </ol>
      ) : <EmptyState title="No finished weeks yet.">Weeks appear here once the commissioner finalizes them.</EmptyState>}
    </>
  );
}
