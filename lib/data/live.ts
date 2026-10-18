import "server-only";
import { notFound } from "next/navigation";
import type { LiveData } from "@/components/views/live-view";
import type { LeagueContext } from "@/lib/auth/context";
import { isEffectivelyLocked } from "@/lib/domain/deadline";
import { sortBoard, summarizeLiveEntry, type LivePickResult } from "@/lib/domain/live-pool";
import { createUserClient } from "@/lib/supabase/server";
import { loadHistory } from "@/lib/data/history";
import { loadLiveFeed } from "@/lib/data/live-feed";
import { liveSnapshot, type StoredLiveGame } from "@/lib/domain/live-snapshot";
import type { ExternalGame } from "@/lib/providers/types";

type Entry = {
  id: string;
  tiebreaker_points: number;
  league_member: { id: string; display_name: string } | null;
  picks: Array<{
    id: string;
    result: LivePickResult;
    selected_side: "HOME" | "AWAY";
    selected_team: { abbreviation: string } | null;
    submitted_line: { home_spread: number } | null;
    game: StoredLiveGame | null;
  }>;
};

export async function loadLive(context: LeagueContext, weekId: string): Promise<LiveData> {
  const supabase = await createUserClient();
  const { data: week, error: weekError } = await supabase.from("weeks").select("id, nfl_week, season_type, status, lock_at, test_lock_active, season:seasons!inner(league_id, year)").eq("id", weekId).maybeSingle();
  if (weekError) throw new Error("Unable to load the live week.");
  const season = (week as unknown as { season: { league_id: string; year: number } | null } | null)?.season;
  if (!week?.lock_at || week.status === "DRAFT" || season?.league_id !== context.leagueId) notFound();
  const summary = { id: week.id, number: week.nfl_week, lockAt: week.lock_at, locked: isEffectivelyLocked(week.status, new Date(week.lock_at)), final: week.status === "FINAL", testLock: week.test_lock_active };
  if (!summary.locked) return { week: summary, entries: [], poll: true };
  if (summary.final) return { week: summary, entries: (await loadHistory(context, weekId)).weeks[0]?.entries ?? [] };

  const { data: raw, error: entryError } = await supabase
    .from("entries")
    .select("id,tiebreaker_points,league_member:league_members(id,display_name),picks(id,result,selected_side,selected_team:teams!picks_selected_team_id_fkey(abbreviation),submitted_line:official_lines!picks_submitted_official_line_id_fkey(home_spread),game:games(id,external_event_id,kickoff_at,status,home_score,away_score,score_override,home_team:teams!games_home_team_id_fkey(abbreviation),away_team:teams!games_away_team_id_fkey(abbreviation)))")
    .eq("week_id", weekId)
    .in("status", ["SUBMITTED", "LOCKED"]);
  if (entryError) throw new Error("Unable to load live entries.");
  const rows = (raw ?? []) as unknown as Entry[];
  let feed: LiveData["feed"];
  const external = new Map<string, ExternalGame>();
  if (!week.test_lock_active) {
    feed = { source: "ESPN", status: "unavailable", observedAt: null };
    try {
      if (season && rows.some(entry => entry.picks.some(pick => pick.game?.external_event_id && !pick.game.score_override))) {
        const snapshot = await loadLiveFeed({ year: season.year, week: week.nfl_week, seasonType: week.season_type });
        for (const game of snapshot.games) external.set(game.externalEventId, game);
        const matched = rows.every(entry => entry.picks.every(({ game }) => game?.score_override || (game && external.has(game.external_event_id ?? "") && external.get(game.external_event_id ?? "")?.home.abbreviation === game.home_team?.abbreviation && external.get(game.external_event_id ?? "")?.away.abbreviation === game.away_team?.abbreviation)));
        feed = { source: "ESPN", status: matched ? "fresh" : "partial", observedAt: snapshot.observedAt };
      }
    } catch { /* Preserve recorded scores and visibly report the interruption. */ }
  }

  const entries = rows.map((entry) => {
    const live = summarizeLiveEntry(entry.picks.map((pick) => pick.result));
    const picks = [...entry.picks]
      .sort((a, b) => new Date(a.game?.kickoff_at ?? 0).getTime() - new Date(b.game?.kickoff_at ?? 0).getTime())
      .map((pick) => {
        const homeSpread = Number(pick.submitted_line?.home_spread ?? 0);
        return { id: pick.id, team: pick.selected_team?.abbreviation ?? "—", spread: pick.selected_side === "HOME" ? homeSpread : -homeSpread, result: pick.result,
          game: pick.game ? liveSnapshot(pick.game, pick.selected_side, external.get(pick.game.external_event_id ?? "")) : undefined,
        };
      });
    return { id: entry.id, name: entry.league_member?.display_name ?? "Player", own: entry.league_member?.id === context.memberId, tiebreaker: entry.tiebreaker_points, alive: live.aliveForFive, correct: live.correct, picks };
  });
  return { week: summary, entries: sortBoard(entries), feed };
}
