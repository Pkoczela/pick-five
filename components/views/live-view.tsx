import Link from "next/link";
import { PoolBoard, type BoardEntry } from "@/components/pool-board";
import { Badge, EmptyState, Notice, PageHeading, Stat } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

export type LiveData = {
  week: { id: string; number: number; lockAt: string; locked: boolean; final: boolean; testLock: boolean };
  entries: BoardEntry[];
};

export function LiveView({ week, entries }: LiveData) {
  if (!week.locked) {
    return (
      <>
        <PageHeading eyebrow={`Week ${week.number} · Pool board`} title="Picks stay private until lock." />
        <EmptyState title="The picks are under wraps." action={<Link href={`/picks/${week.id}`} className="button button-primary">Review your entry</Link>}>
          Every entry is revealed at {formatDateTime(week.lockAt)}.
        </EmptyState>
      </>
    );
  }
  const alive = entries.filter((entry) => entry.alive).length;
  const pending = entries.reduce((total, entry) => total + entry.picks.filter((pick) => pick.result === "PENDING").length, 0);
  return (
    <>
      <PageHeading
        eyebrow={`Week ${week.number} · Pool board`}
        title={week.final ? "The final card." : "Everyone’s five."}
        description="A loss or push takes an entry out of the 5–0 jackpot."
        action={<Badge tone={week.final ? "neutral" : "live"}>{week.final ? "Final" : pending ? "Games in progress" : "Picks revealed"}</Badge>}
      />
      {week.testLock ? <Notice tone="info">Locked-board test is active. These are real submitted picks, temporarily revealed for testing.</Notice> : null}
      <div className="stats-strip">
        <Stat label="Entries" value={entries.length} />
        <Stat label={week.final ? "Went 5–0" : "Still alive"} value={alive} />
        <Stat label="Picks pending" value={pending} />
      </div>
      {entries.length ? <PoolBoard entries={entries} /> : <EmptyState title="No entries this week.">Nobody submitted picks before the deadline.</EmptyState>}
    </>
  );
}
