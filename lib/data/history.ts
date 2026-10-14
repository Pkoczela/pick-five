import "server-only";
import type { HistoryData } from "@/components/views/history-view";
import type { BoardEntry } from "@/components/pool-board";
import type { LivePickResult } from "@/lib/domain/live-pool";
import type { LeagueContext } from "@/lib/auth/context";
import { createUserClient } from "@/lib/supabase/server";

type HistoricalEntry = { id: string; picks: Array<{ id: string; result: LivePickResult; selected_side: "HOME" | "AWAY"; selected_team: { abbreviation: string } | null; submitted_line: { home_spread: number } | null; game: { kickoff_at: string } | null }> };
type HistoricalResult = { entry_id: string; week_id: string; league_member_id: string; correct_count: number; incorrect_count: number; push_count: number; void_count: number; tiebreaker_prediction: number; tiebreaker_actual: number | null; tiebreaker_error: number | null; is_five_and_zero: boolean; is_winner: boolean; winnings_cents: number; league_member: { display_name: string } | null };

export async function loadHistory(context: LeagueContext, weekId?: string): Promise<HistoryData> {
  const supabase = await createUserClient();
  const { data: seasons } = await supabase.from("seasons").select("id, year").eq("league_id", context.leagueId).order("year", { ascending: false });
  const seasonYears = new Map((seasons ?? []).map((season) => [season.id, season.year as number]));
  let query = supabase.from("weeks").select("id, season_id, nfl_week, payout_cents, rollover_out_cents, finalized_at").in("season_id", [...seasonYears.keys()]).eq("status", "FINAL").order("finalized_at", { ascending: false });
  if (weekId) query = query.eq("id", weekId);
  const { data: weeks, error: weekError } = seasonYears.size ? await query : { data: null, error: null };
  if (weekError) throw new Error("Unable to load historical weeks.");
  const weekIds = (weeks ?? []).map((week) => week.id);
  const [resultRows, entryRows] = weekIds.length ? await Promise.all([
    supabase.from("weekly_player_results").select("entry_id, week_id, league_member_id, correct_count, incorrect_count, push_count, void_count, tiebreaker_prediction, tiebreaker_actual, tiebreaker_error, is_five_and_zero, is_winner, winnings_cents, league_member:league_members(display_name)").in("week_id", weekIds),
    supabase.from("entries").select("id, picks(id, result, selected_side, selected_team:teams!picks_selected_team_id_fkey(abbreviation), submitted_line:official_lines!picks_submitted_official_line_id_fkey(home_spread), game:games(kickoff_at))").in("week_id", weekIds).in("status", ["SUBMITTED", "LOCKED"]),
  ]) : [{ data: null, error: null }, { data: null, error: null }];
  if (resultRows.error || entryRows.error) throw new Error("Unable to load historical entries.");
  const results = (resultRows.data ?? []) as unknown as HistoricalResult[];
  const entries = new Map(((entryRows.data ?? []) as unknown as HistoricalEntry[]).map(entry => [entry.id, entry]));
  return {
    leagueName: context.leagueName,
    weeks: (weeks ?? []).map((week) => ({
      id: week.id,
      season: seasonYears.get(week.season_id) ?? 0,
      number: week.nfl_week,
      winners: results.filter(result => result.week_id === week.id && result.is_winner).map(result => result.league_member?.display_name ?? "Player"),
      payoutCents: week.payout_cents ?? 0,
      rolloverCents: week.rollover_out_cents ?? 0,
      finalizedAt: week.finalized_at,
      entries: results.filter(result => result.week_id === week.id).sort((a, b) => Number(b.league_member_id === context.memberId) - Number(a.league_member_id === context.memberId)
        || Number(b.is_winner) - Number(a.is_winner) || b.correct_count - a.correct_count
        || (a.tiebreaker_error ?? Number.MAX_SAFE_INTEGER) - (b.tiebreaker_error ?? Number.MAX_SAFE_INTEGER)
        || (a.league_member?.display_name ?? "").localeCompare(b.league_member?.display_name ?? ""))
        .map((result): BoardEntry => ({
          id: result.entry_id, name: result.league_member?.display_name ?? "Player", own: result.league_member_id === context.memberId,
          tiebreaker: result.tiebreaker_prediction, correct: result.correct_count, alive: result.is_five_and_zero,
          finalResult: { winner: result.is_winner, fiveAndZero: result.is_five_and_zero, incorrect: result.incorrect_count, pushes: result.push_count, voids: result.void_count, actual: result.tiebreaker_actual, error: result.tiebreaker_error, winningsCents: result.winnings_cents },
          picks: [...(entries.get(result.entry_id)?.picks ?? [])].sort((a, b) => new Date(a.game?.kickoff_at ?? 0).getTime() - new Date(b.game?.kickoff_at ?? 0).getTime()).map(pick => ({
            id: pick.id, team: pick.selected_team?.abbreviation ?? "Team", result: pick.result,
            spread: Number(pick.submitted_line?.home_spread ?? 0) * (pick.selected_side === "HOME" ? 1 : -1),
          })),
        })),
    })),
  };
}
