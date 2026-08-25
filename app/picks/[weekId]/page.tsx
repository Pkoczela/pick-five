import Link from "next/link";
import { notFound } from "next/navigation";
import { PickForm, type PickGame } from "@/components/pick-form";
import { requireLeagueContext } from "@/lib/auth/context";
import { createUserClient } from "@/lib/supabase/server";
import { isEffectivelyLocked } from "@/lib/domain/deadline";

type GameRow = {
  id: string; kickoff_at: string;
  home_team: { abbreviation: string; display_name: string } | null;
  away_team: { abbreviation: string; display_name: string } | null;
  official_lines: Array<{ home_spread: number; is_current: boolean }>;
};

export default async function PicksPage({ params }: { params: Promise<{ weekId: string }> }) {
  const { weekId } = await params;
  const context = await requireLeagueContext();
  const supabase = await createUserClient();
  const { data: week } = await supabase.from("weeks").select("id, nfl_week, status, lock_at, tiebreaker_game_id").eq("id", weekId).maybeSingle();
  if (!week || !week.lock_at || week.status === "DRAFT") notFound();
  const { data: rawGames } = await supabase.from("games").select("id, kickoff_at, home_team:teams!games_home_team_id_fkey(abbreviation, display_name), away_team:teams!games_away_team_id_fkey(abbreviation, display_name), official_lines(home_spread, is_current)").eq("week_id", weekId).eq("is_selectable", true).order("kickoff_at");
  const rows = (rawGames ?? []) as unknown as GameRow[];
  const games: PickGame[] = rows.flatMap((row) => {
    const line = row.official_lines.find((candidate) => candidate.is_current);
    if (!row.home_team || !row.away_team || !line) return [];
    return [{ id: row.id, kickoffAt: row.kickoff_at, home: { abbreviation: row.home_team.abbreviation, displayName: row.home_team.display_name }, away: { abbreviation: row.away_team.abbreviation, displayName: row.away_team.display_name }, homeSpread: Number(line.home_spread) }];
  });
  const { data: entry } = await supabase.from("entries").select("id, tiebreaker_points").eq("week_id", weekId).eq("league_member_id", context.memberId).maybeSingle();
  const { data: existing } = entry ? await supabase.from("picks").select("game_id, selected_side").eq("entry_id", entry.id) : { data: null };
  const initialPicks = Object.fromEntries((existing ?? []).map((pick) => [pick.game_id, pick.selected_side])) as Record<string, "HOME" | "AWAY">;
  const tiebreaker = games.find((game) => game.id === week.tiebreaker_game_id);
  const locked = isEffectivelyLocked(week.status, new Date(week.lock_at));

  return (
    <main className="standalone-page pick-page">
      <Link href="/dashboard" className="back-link">← This week</Link>
      <p className="eyebrow">PICK FIVE · WEEK {week.nfl_week}</p>
      <h1>{locked ? "Your picks." : "Make your five."}</h1>
      <p className="page-lede">Choose one side from five different games. The pool’s official lines are frozen for this week.</p>
      <PickForm weekId={week.id} weekNumber={week.nfl_week} games={games} initialPicks={initialPicks} initialTiebreaker={entry?.tiebreaker_points ?? null} tiebreakerLabel={tiebreaker ? `${tiebreaker.away.abbreviation} at ${tiebreaker.home.abbreviation}` : "Designated game"} lockAt={week.lock_at} locked={locked} />
    </main>
  );
}
