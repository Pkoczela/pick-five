import "server-only";
import type { StandingsData } from "@/components/views/standings-view";
import type { LeagueContext } from "@/lib/auth/context";
import { computeStandings, summarizeSeason, type WeeklyResult } from "@/lib/domain/standings";
import { createUserClient } from "@/lib/supabase/server";

export async function loadStandings(context: LeagueContext): Promise<StandingsData> {
  const supabase = await createUserClient();
  const [{ data: members }, { data: seasons }] = await Promise.all([
    supabase.from("league_members").select("id, display_name").eq("league_id", context.leagueId).order("display_name"),
    supabase.from("seasons").select("id").eq("league_id", context.leagueId).eq("status", "ACTIVE").limit(1),
  ]);
  const { data: raw } = seasons?.[0] ? await supabase.from("weekly_player_results").select("league_member_id, week_id, correct_count, is_winner, winnings_cents, weeks!inner(season_id)").eq("weeks.season_id", seasons[0].id) : { data: null };
  const results = (raw ?? []) as unknown as WeeklyResult[];
  return { leagueName: context.leagueName, ownMemberId: context.memberId, rows: computeStandings(members ?? [], results), summary: summarizeSeason(results) };
}
