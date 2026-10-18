import type { GameSnapshot } from "@/lib/domain/pick-progress";
import type { ExternalGame } from "@/lib/providers/types";

export type StoredLiveGame = {
  id: string; external_event_id: string | null; kickoff_at: string;
  status: GameSnapshot["status"]; home_score: number | null; away_score: number | null;
  score_override: boolean; home_team: { abbreviation: string } | null; away_team: { abbreviation: string } | null;
};

export function liveSnapshot(game: StoredLiveGame, side: "HOME" | "AWAY", external?: ExternalGame): GameSnapshot {
  const matches = external?.externalEventId === game.external_event_id
    && external?.home.abbreviation === game.home_team?.abbreviation
    && external?.away.abbreviation === game.away_team?.abbreviation;
  const source = !game.score_override && matches ? external : undefined;
  return {
    id: game.id, selectedSide: side, home: game.home_team?.abbreviation ?? "—", away: game.away_team?.abbreviation ?? "—",
    status: game.score_override ? "FINAL" : source?.status ?? game.status,
    source: game.score_override ? "override" : source ? "provider" : "stored",
    homeScore: source ? source.home.score : game.home_score,
    awayScore: source ? source.away.score : game.away_score,
    detail: game.score_override ? "Commissioner score override" : source?.detail ?? (source?.status === "SCHEDULED" ? "Scheduled" : "Last recorded score"),
  };
}
