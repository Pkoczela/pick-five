import type { LivePickResult } from "./live-pool";

export type GameSnapshot = {
  id: string;
  away: string;
  home: string;
  awayScore: number | null;
  homeScore: number | null;
  selectedSide: "HOME" | "AWAY";
  status: "SCHEDULED" | "IN_PROGRESS" | "FINAL" | "POSTPONED" | "CANCELED";
  detail: string;
  source?: "provider" | "stored" | "override";
};
export type ProgressPick = { result: LivePickResult; spread: number; game?: GameSnapshot };
export function pickProgress(pick: ProgressPick) {
  const final = {
    CORRECT: { tone: "covered", label: "FINAL · Covered", symbol: "✓" },
    INCORRECT: { tone: "missed", label: "FINAL · Missed", symbol: "✕" },
    PUSH: { tone: "push", label: "FINAL · Push", symbol: "—" },
    VOID: { tone: "push", label: "Void", symbol: "—" },
  };
  if (pick.result !== "PENDING") return final[pick.result];
  const game = pick.game;
  if (game?.status === "IN_PROGRESS" && game.homeScore !== null && game.awayScore !== null) {
    const margin = (game.selectedSide === "HOME" ? game.homeScore - game.awayScore : game.awayScore - game.homeScore) + pick.spread;
    return margin > 0 ? { tone: "covering", label: "LIVE · Covering", symbol: "↗" }
      : margin < 0 ? { tone: "trailing", label: "LIVE · Not covering", symbol: "↘" }
      : { tone: "tied", label: "LIVE · On the number", symbol: "=" };
  }
  return { tone: "upcoming", label: game?.status === "FINAL" ? "Awaiting grading" : game?.status === "POSTPONED" ? "Postponed" : game?.status === "CANCELED" ? "Canceled" : game?.status === "IN_PROGRESS" ? "LIVE · Score unavailable" : game?.detail ?? "Upcoming", symbol: "•" };
}
