import { NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createUserClient } from "@/lib/supabase/server";
import { EspnNflProvider } from "@/lib/providers/espn";
import { redirectWith } from "@/lib/http/redirect";
import { requireAdminContext } from "@/lib/auth/context";

const schema = z.object({ weekId: z.uuid(), year: z.coerce.number().int(), nflWeek: z.coerce.number().int(), seasonType: z.coerce.number().int() });

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return redirectWith(request, "/admin/weeks", "error", "Invalid import request.");
  const context = await requireAdminContext();
  const userClient = await createUserClient();
  const { data: rawWeek } = await userClient.from("weeks").select("id,season:seasons!inner(league_id)").eq("id", parsed.data.weekId).maybeSingle();
  const week = rawWeek as unknown as { id: string; season: { league_id: string } | null } | null;
  if (!week?.season || week.season.league_id !== context.leagueId) return redirectWith(request, "/admin/weeks", "error", "That week does not belong to the selected league.");

  try {
    const games = await new EspnNflProvider().getWeekSchedule({ year: parsed.data.year, week: parsed.data.nflWeek, seasonType: parsed.data.seasonType });
    const admin = createAdminClient();
    const abbreviations = [...new Set(games.flatMap((game) => [game.home.abbreviation, game.away.abbreviation]))];
    const { data: teams } = await admin.from("teams").select("id, abbreviation").in("abbreviation", abbreviations);
    const teamMap = new Map((teams ?? []).map((team) => [team.abbreviation, team.id]));
    const unmatched = abbreviations.filter((abbreviation) => !teamMap.has(abbreviation));
    if (unmatched.length > 0) throw new Error(`ESPN teams could not be matched: ${unmatched.join(", ")}.`);

    for (const game of games) {
      const { data: existing } = await admin.from("games").select("id, score_override").eq("external_source", "ESPN").eq("external_event_id", game.externalEventId).maybeSingle();
      const base = {
        week_id: parsed.data.weekId,
        external_source: "ESPN",
        external_event_id: game.externalEventId,
        home_team_id: teamMap.get(game.home.abbreviation),
        away_team_id: teamMap.get(game.away.abbreviation),
        kickoff_at: game.kickoffAt,
        last_synced_at: new Date().toISOString(),
      };
      if (existing) {
        await admin.from("games").update(existing.score_override ? base : { ...base, status: game.status, home_score: game.home.score, away_score: game.away.score }).eq("id", existing.id);
      } else {
        await admin.from("games").insert({ ...base, status: game.status, home_score: game.home.score, away_score: game.away.score });
      }
    }
    return redirectWith(request, "/admin/weeks", "notice", `Imported ${games.length} NFL games from ESPN.`);
  } catch (error) {
    return redirectWith(request, "/admin/weeks", "error", error instanceof Error ? error.message : "Schedule import failed.");
  }
}
