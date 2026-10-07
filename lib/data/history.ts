import "server-only";
import type { HistoryData } from "@/components/views/history-view";
import type { LeagueContext } from "@/lib/auth/context";
import { createUserClient } from "@/lib/supabase/server";

export async function loadHistory(context: LeagueContext): Promise<HistoryData> {
  const supabase = await createUserClient();
  const { data: seasons } = await supabase.from("seasons").select("id, year").eq("league_id", context.leagueId).order("year", { ascending: false });
  const seasonYears = new Map((seasons ?? []).map((season) => [season.id, season.year as number]));
  const { data: weeks } = seasonYears.size ? await supabase.from("weeks").select("id, season_id, nfl_week, payout_cents, rollover_out_cents, finalized_at").in("season_id", [...seasonYears.keys()]).eq("status", "FINAL").order("finalized_at", { ascending: false }) : { data: null };
  const weekIds = (weeks ?? []).map((week) => week.id);
  const { data: winners } = weekIds.length ? await supabase.from("weekly_player_results").select("week_id, league_member:league_members(display_name)").in("week_id", weekIds).eq("is_winner", true) : { data: null };
  const winnerRows = (winners ?? []) as unknown as Array<{ week_id: string; league_member: { display_name: string } | null }>;
  return {
    leagueName: context.leagueName,
    weeks: (weeks ?? []).map((week) => ({
      id: week.id,
      season: seasonYears.get(week.season_id) ?? 0,
      number: week.nfl_week,
      winners: winnerRows.filter((winner) => winner.week_id === week.id).flatMap((winner) => winner.league_member ? [winner.league_member.display_name] : []),
      payoutCents: week.payout_cents ?? 0,
      rolloverCents: week.rollover_out_cents ?? 0,
    })),
  };
}
