"use client";

import { useEffect, useState } from "react";
import { PoolBoard, type BoardEntry } from "@/components/pool-board";

/** Fictional snapshots only: no fetch, grading, or database writes. */
export function LiveScoreboard({ entries, simulate = false }: { entries: BoardEntry[]; simulate?: boolean }) {
  const [frame, setFrame] = useState(0);
  const [paused, setPaused] = useState(false);
  const [stale, setStale] = useState(false);
  const [age, setAge] = useState(0);
  useEffect(() => {
    if (!simulate) return;
    const timer = setInterval(() => {
      if (!paused && !stale && document.visibilityState === "visible") {
        setFrame(f => f + 1); setAge(0);
      } else setAge(a => a + 8);
    }, 8000);
    return () => clearInterval(timer);
  }, [simulate, paused, stale]);
  const shown = !simulate ? entries : entries.map(entry => ({ ...entry, picks: entry.picks.map(pick => {
    if (pick.game?.status !== "IN_PROGRESS") return pick;
    const step = frame % 3;
    const index = Number(pick.game.id.split("-").at(-1));
    return { ...pick, game: { ...pick.game,
      homeScore: step === 2 && index === 5 ? 24 : 17,
      awayScore: index === 6 ? 17 : step === 0 ? 14 : index === 4 ? step === 1 ? 21 : 28 : 24,
      detail: ["Q3 · 6:42", "Q3 · 3:18", "Q4 · 12:05"][step],
    } };
  }) }));
  return <>
    {simulate && <section className="score-feed" aria-label="Sample score controls">
      <div><strong>{stale ? "Updates interrupted · showing last scores" : paused ? "Sample updates paused" : "Simulated live updates"}</strong><p>Fictional scores · 8-second demo cycle · no production data</p><small role="status">{age ? `Last sample update at least ${age}s ago` : "Sample scores up to date"}</small></div>
      <div className="button-row"><button className="button button-quiet" onClick={() => setPaused(p => !p)}>{paused ? "Resume demo" : "Pause demo"}</button><button className="button button-quiet" disabled={stale} onClick={() => { setFrame(f => f + 1); setAge(0); }}>Next score update</button><label className="check-field"><input type="checkbox" checked={stale} onChange={e => setStale(e.target.checked)} />Simulate connection loss</label></div>
    </section>}
    <details className="live-color-key"><summary>How to read the colors</summary><div><span className="progress-covering">↗ Live · Covering</span><span className="progress-covered">✓ Final · Covered</span><span className="progress-trailing">↘ Live · Not covering</span><span className="progress-missed">✕ Final · Missed</span><span className="progress-tied">= Live · On the number</span><span className="progress-push">— Final · Push / Void</span></div><p>Live colors are provisional. Only official results affect 5–0 eligibility.</p></details>
    <PoolBoard entries={shown} />
  </>;
}
