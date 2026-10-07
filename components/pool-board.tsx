"use client";

import { useState } from "react";
import { EmptyState } from "@/components/ui";
import type { LivePickResult } from "@/lib/domain/live-pool";
import { formatSpread } from "@/lib/format";

export type BoardEntry = {
  id: string;
  name: string;
  own: boolean;
  tiebreaker: number;
  alive: boolean;
  correct: number;
  picks: Array<{ id: string; team: string; spread: number; result: LivePickResult }>;
};

const filters = ["Everyone", "Still alive", "Mine"] as const;
const resultLabels: Record<LivePickResult, string> = { CORRECT: "Correct", INCORRECT: "Missed", PENDING: "Pending", PUSH: "Push", VOID: "Void" };
const resultSymbols: Record<LivePickResult, string> = { CORRECT: "✓", INCORRECT: "✕", PENDING: "•", PUSH: "–", VOID: "–" };

export function PoolBoard({ entries }: { entries: BoardEntry[] }) {
  const [filter, setFilter] = useState<(typeof filters)[number]>("Everyone");
  const [query, setQuery] = useState("");
  const visible = entries.filter((entry) =>
    (filter === "Everyone" || (filter === "Mine" ? entry.own : entry.alive)) && entry.name.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <>
      <div className="board-toolbar">
        <div className="segmented" role="group" aria-label="Show entries">
          {filters.map((label) => <button key={label} type="button" aria-pressed={filter === label} onClick={() => setFilter(label)}>{label}</button>)}
        </div>
        {entries.length > 6 ? <label className="search-field"><span className="sr-only">Find a player</span><input type="search" placeholder="Find a player" value={query} onChange={(event) => setQuery(event.target.value)} /></label> : null}
      </div>
      {visible.length ? (
        <div className="pool-grid">
          {visible.map((entry) => (
            <article className={`player-card ${entry.own ? "own-entry" : ""}`} key={entry.id}>
              <div className="player-card-head">
                <div>
                  <h2>{entry.name}{entry.own ? <span className="you-tag">You</span> : null}</h2>
                  <span>{entry.correct} of 5 correct</span>
                </div>
                <span className={`alive-flag ${entry.alive ? "is-alive" : ""}`}>{entry.alive ? "Alive for 5–0" : "Eliminated"}</span>
              </div>
              <ul>
                {entry.picks.map((pick) => (
                  <li key={pick.id} className={`pick-result pick-result-${pick.result.toLowerCase()}`}>
                    <strong>{pick.team} <span className="result-spread">{formatSpread(pick.spread)}</span></strong>
                    <span><span aria-hidden="true">{resultSymbols[pick.result]}</span> {resultLabels[pick.result]}</span>
                  </li>
                ))}
              </ul>
              <footer>Tiebreaker <strong>{entry.tiebreaker}</strong></footer>
            </article>
          ))}
        </div>
      ) : <EmptyState title="No matching entries.">Try another name or filter.</EmptyState>}
    </>
  );
}
