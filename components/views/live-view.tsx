"use client";

import Link from "next/link";
import { useLiveUpdates } from "@/components/use-live-updates";
import type { BoardEntry } from "@/components/pool-board";
import { LiveScoreboard } from "@/components/live-scoreboard";
import { Badge, EmptyState, Notice, PageHeading, Stat } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

export type LiveData = {
  week: { id: string; number: number; lockAt: string; locked: boolean; final: boolean; testLock: boolean };
  entries: BoardEntry[];
  simulate?: boolean;
  poll?: boolean;
  feed?: { source: "ESPN" | "Sample"; status: "fresh" | "partial" | "unavailable"; observedAt: string | null };
};

export function LiveView(initial: LiveData) {
  const updates = useLiveUpdates(initial);
  const { week, entries, simulate = false, feed } = updates.data;
  if (updates.denied) return <EmptyState title="This board is no longer available.">Sign in again or return to your active league to continue.</EmptyState>;
  if (!week.locked) {
    return (
      <>
        <PageHeading eyebrow={`Week ${week.number} · Pool board`} title="Picks stay private until lock." />
        <EmptyState title="The picks are under wraps." action={<Link href={`/picks/${week.id}`} className="button button-primary">Review your entry</Link>}>
          Every entry is revealed at {formatDateTime(week.lockAt)}. This page checks automatically while visible.
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
        action={<Badge tone={week.final ? "neutral" : "live"}>{week.final ? "Final" : entries.some(e => e.picks.some(p => p.game?.status === "IN_PROGRESS")) ? "Games in progress" : "Picks revealed"}</Badge>}
      />
      {week.testLock ? <Notice tone="info">Locked-board test is active. These are real submitted picks, temporarily revealed for testing.</Notice> : null}
      <div className="stats-strip">
        <Stat label="Entries" value={entries.length} />
        <Stat label={week.final ? "Went 5–0" : "Still alive"} value={alive} />
        <Stat label="Picks pending" value={pending} />
      </div>
      {feed && <section className="score-feed" aria-label="Score updates">
        <div><strong role="status">{updates.failed ? "Updates interrupted · scores may be delayed" : `${feed.source} scores · auto-refresh on`}</strong>
          <p>Refreshes about every 30 seconds while this page is visible. Live colors are provisional; official grading is unchanged.</p>
          <small>{feed.observedAt ? `Last successful check${updates.age !== null ? ` ${updates.age}s ago` : " just now"}` : "No live update received yet"}</small>
          {feed.source === "Sample" && <p>Fictional preview feed · same refresh path · use “Fail saves” to test interruption.</p>}
        </div>
        <button type="button" className="button button-quiet" disabled={updates.loading} onClick={updates.refresh}>{updates.loading ? "Refreshing…" : "Refresh scores"}</button>
      </section>}
      {entries.length ? <LiveScoreboard key={`${week.id}-${week.final}-${simulate}`} entries={entries} simulate={simulate} /> : <EmptyState title="No entries this week.">Nobody submitted picks before the deadline.</EmptyState>}
    </>
  );
}
