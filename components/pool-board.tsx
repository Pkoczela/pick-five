"use client";

import { useState } from "react";
import { EmptyState } from "@/components/ui";
import type { LivePickResult } from "@/lib/domain/live-pool";
import { formatMoney, formatSpread } from "@/lib/format";
import { pickProgress, type GameSnapshot } from "@/lib/domain/pick-progress";

export type BoardEntry = {
  id: string;
  name: string;
  own: boolean;
  tiebreaker: number;
  alive: boolean;
  correct: number;
  finalResult?: { winner: boolean; fiveAndZero: boolean; incorrect: number; pushes: number; voids: number; actual: number | null; error: number | null; winningsCents: number };
  picks: Array<{ id: string; team: string; spread: number; result: LivePickResult; game?: GameSnapshot }>;
};

const filters = ["Everyone", "Still alive", "Mine"] as const;
export function EntryCard({ entry }: { entry: BoardEntry }) {
  const progress = entry.picks.map(pickProgress);
  const summary = [["covered", "covered"], ["missed", "missed"], ["covering", "covering"], ["trailing", "not covering"], ["tied", "on the number"], ["push", "push / void"], ["upcoming", "pending"]]
    .map(([tone, label]) => ({ count: progress.filter(p => p.tone === tone).length, label })).filter(p => p.count).map(p => `${p.count} ${p.label}`).join(" · ");
  return <article className={`player-card ${entry.own ? "own-entry" : ""}`}>
    <div className="player-card-head"><div><h2>{entry.name}{entry.own && <span className="you-tag">You</span>}</h2><span>{entry.finalResult ? `${entry.correct} correct · ${entry.finalResult.incorrect} incorrect · ${entry.finalResult.pushes} push · ${entry.finalResult.voids} void` : summary}</span></div><span className={`alive-flag ${entry.alive ? "is-alive" : ""}`}>{entry.finalResult ? entry.finalResult.winner ? "Winner" : entry.finalResult.fiveAndZero ? "5–0" : "Final" : entry.alive ? "Alive for 5–0" : "Out of 5–0"}</span></div>
    <div className="pick-progress-strip" aria-label="Five-pick progress">{entry.picks.map((pick, i) => <span key={pick.id} className={`progress-${progress[i].tone}`} title={`${pick.team}: ${progress[i].label}`}><b>{pick.team}</b><span aria-hidden="true">{progress[i].symbol}</span><span className="sr-only">{progress[i].label}</span></span>)}</div>
    <ul>{entry.picks.map((pick, i) => <li key={pick.id} className={`live-pick-row progress-${progress[i].tone}`}>
      <div className="live-pick-heading"><strong>{pick.team} {formatSpread(pick.spread)}</strong><span>{progress[i].symbol} {progress[i].label}</span></div>
      {pick.game && <div className="live-game-score"><strong>{pick.game.away} {pick.game.awayScore ?? "—"} <span aria-hidden="true">–</span> {pick.game.home} {pick.game.homeScore ?? "—"}</strong><span>{pick.game.detail}</span></div>}
    </li>)}</ul><footer className="entry-result-footer"><span>{entry.finalResult ? "Prediction" : "Tiebreaker"} <strong>{entry.tiebreaker}</strong></span>{entry.finalResult && <><span>Actual <strong>{entry.finalResult.actual ?? "—"}</strong></span><span>Error <strong>{entry.finalResult.error ?? "—"}</strong></span>{entry.finalResult.winningsCents > 0 && <span>Won <strong>{formatMoney(entry.finalResult.winningsCents)}</strong></span>}</>}</footer>
  </article>;
}

export function PoolBoard({ entries }: { entries: BoardEntry[] }) {
  const [filter, setFilter] = useState<(typeof filters)[number]>("Everyone");
  const [query, setQuery] = useState("");
  const own = entries.find(entry => entry.own);
  const visible = entries.filter((entry) => !entry.own &&
    (filter === "Everyone" || (filter === "Mine" ? entry.own : entry.alive)) && entry.name.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <>
      {own && <section className="own-live-section" id="your-five" aria-label="Your five"><p className="eyebrow">YOUR FIVE · ALWAYS FIRST</p><EntryCard entry={own} /></section>}
      <div className="section-heading"><h2>The league</h2>{own && <a className="text-link" href="#your-five">Back to my picks ↑</a>}</div>
      <div className="board-toolbar">
        <div className="segmented" role="group" aria-label="Show entries">
          {filters.map((label) => <button key={label} type="button" aria-pressed={filter === label} onClick={() => setFilter(label)}>{label}</button>)}
        </div>
        {entries.length > 6 ? <label className="search-field"><span className="sr-only">Find a player</span><input type="search" placeholder="Find a player" value={query} onChange={(event) => setQuery(event.target.value)} /></label> : null}
      </div>
      {visible.length ? (
        <div className="pool-grid">
          {visible.map((entry) => <EntryCard entry={entry} key={entry.id} />)}
        </div>
      ) : filter === "Mine" && own ? <p className="helper-text">Your entry is pinned above.</p> : <EmptyState title="No matching league entries.">Your card stays above. Try another name or filter.</EmptyState>}
    </>
  );
}
