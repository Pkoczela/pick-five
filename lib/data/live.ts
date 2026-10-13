import "server-only";
import { notFound } from "next/navigation";
import type { LiveData } from "@/components/views/live-view";
import type { LeagueContext } from "@/lib/auth/context";
import { isEffectivelyLocked } from "@/lib/domain/deadline";
import { sortBoard, summarizeLiveEntry, type LivePickResult } from "@/lib/domain/live-pool";
import { createUserClient } from "@/lib/supabase/server";
import { loadHistory } from "@/lib/data/history";

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
    game: { kickoff_at: string } | null;
  }>;
};

export async function loadLive(context: LeagueContext, weekId: string): Promise<LiveData> {
  const supabase = await createUserClient();
  const { data: week } = await supabase.from("weeks").select("id, nfl_week, status, lock_at, test_lock_active, season:seasons!inner(league_id)").eq("id", weekId).maybeSingle();
  const weekLeagueId = (week as unknown as { season: { league_id: string } | null } | null)?.season?.league_id;
  if (!week?.lock_at || weekLeagueId !== context.leagueId) notFound();
  const summary = { id: week.id, number: week.nfl_week, lockAt: week.lock_at, locked: isEffectivelyLocked(week.status, new Date(week.lock_at)), final: week.status === "FINAL", testLock: week.test_lock_active };
  if (!summary.locked) return { week: summary, entries: [] };
  if (summary.final) return { week: summary, entries: (await loadHistory(context, weekId)).weeks[0]?.entries ?? [] };

  const { data: raw } = await supabase
    .from("entries")
    .select("id,tiebreaker_points,league_member:league_members(id,display_name),picks(id,result,selected_side,selected_team:teams!picks_selected_team_id_fkey(abbreviation),submitted_line:official_lines!picks_submitted_official_line_id_fkey(home_spread),game:games(kickoff_at))")
    .eq("week_id", weekId)
    .in("status", ["SUBMITTED", "LOCKED"]);

  const entries = ((raw ?? []) as unknown as Entry[]).map((entry) => {
    const live = summarizeLiveEntry(entry.picks.map((pick) => pick.result));
    const picks = [...entry.picks]
      .sort((a, b) => new Date(a.game?.kickoff_at ?? 0).getTime() - new Date(b.game?.kickoff_at ?? 0).getTime())
      .map((pick) => {
        const homeSpread = Number(pick.submitted_line?.home_spread ?? 0);
        return { id: pick.id, team: pick.selected_team?.abbreviation ?? "—", spread: pick.selected_side === "HOME" ? homeSpread : -homeSpread, result: pick.result };
      });
    return { id: entry.id, name: entry.league_member?.display_name ?? "Player", own: entry.league_member?.id === context.memberId, tiebreaker: entry.tiebreaker_points, alive: live.aliveForFive, correct: live.correct, picks };
  });
  return { week: summary, entries: sortBoard(entries) };
}
