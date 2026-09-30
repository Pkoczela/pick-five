import { Badge } from "@/components/ui";

export type ResultPick = { team: string; spread: string; result: "CORRECT" | "INCORRECT" | "PENDING" | "PUSH" | "VOID" };
const labels = { CORRECT: "✓ Correct", INCORRECT: "× Incorrect", PENDING: "· Pending", PUSH: "— Push", VOID: "— Void" };
export function ResultCard({ name, own = false, picks, prediction, winner = false, actual, winnings }: { name: string; own?: boolean; picks: ResultPick[]; prediction: number; winner?: boolean; actual?: number; winnings?: string }) {
  const correct = picks.filter(p => p.result === "CORRECT").length;
  const pending = picks.filter(p => p.result === "PENDING").length;
  const alive = picks.every(p => p.result === "CORRECT" || p.result === "PENDING");
  return <article className={`player-card ${own ? "own-entry" : ""}`}>
    <div className="player-card-head"><div><span className="card-kicker">{own ? "YOUR ENTRY" : "POOL ENTRY"}</span><h2>{name}</h2><span>{correct} correct · {pending} pending</span></div><Badge tone={winner ? "success" : alive ? "live" : "neutral"}>{winner ? "Winner" : alive ? "Alive for 5–0" : "Out of 5–0"}</Badge></div>
    <ul>{picks.map((p, i) => <li key={i} className={`pick-result-${p.result.toLowerCase()}`}><strong>{p.team} <span className="result-spread">{p.spread}</span></strong><span>{labels[p.result]}</span></li>)}</ul>
    <footer><span>Tiebreaker <strong>{prediction}</strong></span>{actual !== undefined && <span>Actual <strong>{actual}</strong></span>}{winnings && <span>Won <strong>{winnings}</strong></span>}</footer>
  </article>;
}
