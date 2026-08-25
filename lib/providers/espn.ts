import "server-only";
import { z } from "zod";
import type { ExternalGame, ScheduleProvider } from "./types";

const competitorSchema = z.object({
  homeAway: z.enum(["home", "away"]),
  score: z.string().optional(),
  team: z.object({ id: z.string(), abbreviation: z.string(), displayName: z.string() }),
});
const eventSchema = z.object({
  id: z.string(),
  date: z.string(),
  status: z.object({ type: z.object({ name: z.string(), completed: z.boolean().optional() }) }),
  competitions: z.array(z.object({ competitors: z.array(competitorSchema) })).min(1),
});
const responseSchema = z.object({ events: z.array(eventSchema).default([]) });

export class EspnNflProvider implements ScheduleProvider {
  constructor(private readonly baseUrl = process.env.ESPN_SCOREBOARD_BASE_URL ?? "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard") {}

  async getWeekSchedule(params: { year: number; week: number; seasonType: number }): Promise<ExternalGame[]> {
    const url = new URL(this.baseUrl);
    url.searchParams.set("dates", String(params.year));
    url.searchParams.set("seasontype", String(params.seasonType));
    url.searchParams.set("week", String(params.week));
    const payload = await this.fetchWithRetry(url);
    const parsed = responseSchema.safeParse(payload);
    if (!parsed.success) throw new Error("ESPN returned schedule data in an unexpected format.");
    return parsed.data.events.map(mapEvent);
  }

  private async fetchWithRetry(url: URL) {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(8_000), cache: "no-store" });
        if (!response.ok) throw new Error(`ESPN request failed with status ${response.status}`);
        return await response.json() as unknown;
      } catch (error) {
        lastError = error;
      }
    }
    throw new Error(`ESPN schedule import failed: ${lastError instanceof Error ? lastError.message : "unknown error"}`);
  }
}

function mapEvent(event: z.infer<typeof eventSchema>): ExternalGame {
  const competitors = event.competitions[0].competitors;
  const home = competitors.find((team) => team.homeAway === "home");
  const away = competitors.find((team) => team.homeAway === "away");
  if (!home || !away) throw new Error(`ESPN event ${event.id} is missing a home or away team.`);
  return {
    externalSource: "ESPN",
    externalEventId: event.id,
    kickoffAt: new Date(event.date).toISOString(),
    status: mapStatus(event.status.type.name, event.status.type.completed),
    home: mapTeam(home),
    away: mapTeam(away),
  };
}

function mapTeam(team: z.infer<typeof competitorSchema>) {
  const numericScore = team.score === undefined || team.score === "" ? null : Number(team.score);
  return {
    externalTeamId: team.team.id,
    abbreviation: canonicalizeNflAbbreviation(team.team.abbreviation),
    displayName: team.team.displayName,
    score: Number.isFinite(numericScore) ? numericScore : null,
  };
}

export function canonicalizeNflAbbreviation(abbreviation: string) {
  return abbreviation === "WSH" ? "WAS" : abbreviation;
}

function mapStatus(name: string, completed?: boolean): ExternalGame["status"] {
  if (completed || name.includes("FINAL")) return "FINAL";
  if (name.includes("POSTPONED")) return "POSTPONED";
  if (name.includes("CANCELED")) return "CANCELED";
  if (name.includes("IN_PROGRESS") || name.includes("HALFTIME") || name.includes("END_PERIOD")) return "IN_PROGRESS";
  return "SCHEDULED";
}
