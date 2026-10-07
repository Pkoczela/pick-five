import "server-only";
import { notFound } from "next/navigation";
import type { PickGame } from "@/components/pick-form";
import type { PicksData } from "@/components/views/picks-view";
import type { LeagueContext } from "@/lib/auth/context";
import { isEffectivelyLocked } from "@/lib/domain/deadline";
import { createAdminClient } from "@/lib/supabase/admin";
import { createUserClient } from "@/lib/supabase/server";

type GameRow = {
  id: string; kickoff_at: string;
  home_team: { abbreviation: string; display_name: string } | null;
  away_team: { abbreviation: string; display_name: string } | null;
  official_lines: Array<{ home_spread: number; is_current: boolean }>;
};
type Client = Awaited<ReturnType<typeof createUserClient>> | ReturnType<typeof createAdminClient>;

/** The signed-in player's own entry. */
export async function loadPicks(context: LeagueContext, weekId: string): Promise<PicksData> {
  const supabase = await createUserClient();
  const week = await loadWeek(supabase, weekId, context.leagueId);
  if (!week) notFound();
  return { ...await loadEntry(supabase, week, context.memberId), locked: isEffectivelyLocked(week.status, new Date(week.lock_at)) };
}

/** Explicit, audited commissioner access to another player's entry. */
export async function loadCommissionerEntry(context: LeagueContext, weekId: string, memberId: string): Promise<PicksData & { memberName: string }> {
  const admin = createAdminClient();
  const { data: member } = await admin.from("league_members").select("id,display_name").eq("id", memberId).eq("league_id", context.leagueId).maybeSingle();
  const week = await loadWeek(admin, weekId, context.leagueId);
  if (!member || !week || week.status === "FINAL") notFound();
  await admin.from("audit_events").insert({ league_id: context.leagueId, actor_user_id: context.userId, entity_type: "entry", entity_id: null, event_type: "PLAYER_ENTRY_OPENED_BY_COMMISSIONER", after_json: { week_id: weekId, member_id: memberId }, reason: "Explicit View/Edit Entry action" });
  return { ...await loadEntry(admin, week, memberId), locked: true, memberName: member.display_name };
}

async function loadWeek(supabase: Client, weekId: string, leagueId: string) {
  const { data } = await supabase.from("weeks").select("id, nfl_week, status, lock_at, tiebreaker_game_id, season:seasons!inner(league_id)").eq("id", weekId).maybeSingle();
  const week = data as unknown as { id: string; nfl_week: number; status: string; lock_at: string | null; tiebreaker_game_id: string | null; season: { league_id: string } | null } | null;
  if (!week || !week.lock_at || week.status === "DRAFT" || week.season?.league_id !== leagueId) return null;
  return { ...week, lock_at: week.lock_at };
}

async function loadEntry(supabase: Client, week: { id: string; nfl_week: number; lock_at: string; tiebreaker_game_id: string | null }, memberId: string): Promise<Omit<PicksData, "locked">> {
  const { data: rawGames } = await supabase.from("games").select("id, kickoff_at, home_team:teams!games_home_team_id_fkey(abbreviation, display_name), away_team:teams!games_away_team_id_fkey(abbreviation, display_name), official_lines(home_spread, is_current)").eq("week_id", week.id).eq("is_selectable", true).order("kickoff_at");
  const games: PickGame[] = ((rawGames ?? []) as unknown as GameRow[]).flatMap((row) => {
    const line = row.official_lines.find((candidate) => candidate.is_current);
    if (!row.home_team || !row.away_team || !line) return [];
    return [{ id: row.id, kickoffAt: row.kickoff_at, home: { abbreviation: row.home_team.abbreviation, displayName: row.home_team.display_name }, away: { abbreviation: row.away_team.abbreviation, displayName: row.away_team.display_name }, homeSpread: Number(line.home_spread) }];
  });
  const { data: entry } = await supabase.from("entries").select("id, tiebreaker_points").eq("week_id", week.id).eq("league_member_id", memberId).maybeSingle();
  const { data: existing } = entry ? await supabase.from("picks").select("game_id, selected_side").eq("entry_id", entry.id) : { data: null };
  const tiebreaker = games.find((game) => game.id === week.tiebreaker_game_id);
  return {
    weekId: week.id,
    weekNumber: week.nfl_week,
    lockAt: week.lock_at,
    games,
    initialPicks: Object.fromEntries((existing ?? []).map((pick) => [pick.game_id, pick.selected_side])) as Record<string, "HOME" | "AWAY">,
    initialTiebreaker: entry?.tiebreaker_points ?? null,
    tiebreakerLabel: tiebreaker ? `${tiebreaker.away.displayName} at ${tiebreaker.home.displayName}` : "Designated game",
  };
}
