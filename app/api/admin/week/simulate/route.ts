import { NextRequest } from "next/server";
import { z } from "zod";
import { buildSimulatedAtsResults, simulatedFinalScore, type SimulationEntry } from "@/lib/domain/simulation";
import { redirectWith } from "@/lib/http/redirect";
import { createUserClient } from "@/lib/supabase/server";

const schema = z.object({
  weekId: z.string().uuid(),
  scenario: z.enum(["FIVE_ZERO", "NO_WINNER"]),
  targetEntryId: z.string().optional(),
  mnfTotal: z.coerce.number().int().min(0).max(200),
  reason: z.string().trim().min(3).max(300),
});

type GameRow = { id: string; official_lines: Array<{ home_spread: number; is_current: boolean }> };
type EntryRow = { id: string; picks: Array<{ game_id: string; selected_side: "HOME" | "AWAY" }> };

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return redirectWith(request, "/admin/results", "error", parsed.error.issues[0]?.message ?? "Invalid simulation request");
  const supabase = await createUserClient();
  const { data: week, error: weekError } = await supabase.from("weeks").select("id,tiebreaker_game_id,test_lock_active").eq("id", parsed.data.weekId).maybeSingle();
  if (weekError || !week?.test_lock_active) return redirectWith(request, "/admin/results", "error", weekError?.message ?? "Start the week simulation first.");
  const { data: rawGames, error: gamesError } = await supabase.from("games").select("id,official_lines(home_spread,is_current)").eq("week_id", week.id);
  const { data: rawEntries, error: entriesError } = await supabase.from("entries").select("id,picks(game_id,selected_side)").eq("week_id", week.id).in("status", ["SUBMITTED", "LOCKED"]);
  if (gamesError || entriesError) return redirectWith(request, "/admin/results", "error", gamesError?.message ?? entriesError?.message ?? "Could not load simulation data.");

  try {
    const games = (rawGames ?? []) as unknown as GameRow[];
    const entries = ((rawEntries ?? []) as unknown as EntryRow[]).map<SimulationEntry>((entry) => ({
      id: entry.id,
      picks: entry.picks.map((pick) => ({ gameId: pick.game_id, selectedSide: pick.selected_side })),
    }));
    const results = buildSimulatedAtsResults(games.map((game) => game.id), entries, parsed.data.scenario, parsed.data.targetEntryId || undefined);
    const assignments = games.map((game) => {
      const atsResult = results.get(game.id) ?? "HOME";
      const spread = Number(game.official_lines.find((line) => line.is_current)?.home_spread ?? 0);
      const score = simulatedFinalScore(atsResult, spread, game.id === week.tiebreaker_game_id ? parsed.data.mnfTotal : undefined);
      return { game_id: game.id, ats_result: atsResult, home_score: score.homeScore, away_score: score.awayScore };
    });
    const { error } = await supabase.rpc("apply_week_simulation", { p_week_id: week.id, p_assignments: assignments, p_reason: parsed.data.reason });
    if (error) throw error;
    const notice = parsed.data.scenario === "FIVE_ZERO" ? "Simulated results applied. The selected entry is 5–0." : "Simulated results applied. Every entry has at least one loss.";
    return redirectWith(request, "/admin/results", "notice", notice);
  } catch (error) {
    return redirectWith(request, "/admin/results", "error", error instanceof Error ? error.message : "Simulation failed.");
  }
}
