import { afterEach, describe, expect, it, vi } from "vitest";
import { EspnNflProvider } from "@/lib/providers/espn";

const fixture = {
  events: [{
    id: "401000001",
    date: "2026-09-11T00:20:00Z",
    status: { type: { name: "STATUS_FINAL", completed: true } },
    competitions: [{ competitors: [
      { homeAway: "home", score: "24", team: { id: "17", abbreviation: "NE", displayName: "New England Patriots" } },
      { homeAway: "away", score: "27", team: { id: "2", abbreviation: "BUF", displayName: "Buffalo Bills" } },
    ] }],
  }],
};

afterEach(() => vi.unstubAllGlobals());

describe("EspnNflProvider", () => {
  it("normalizes an ESPN event into the provider-neutral contract", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(fixture), { status: 200 })));
    const games = await new EspnNflProvider("https://example.test/scoreboard").getWeekSchedule({ year: 2026, week: 1, seasonType: 2 });
    expect(games).toEqual([expect.objectContaining({
      externalEventId: "401000001",
      status: "FINAL",
      home: expect.objectContaining({ abbreviation: "NE", score: 24 }),
      away: expect.objectContaining({ abbreviation: "BUF", score: 27 }),
    })]);
  });

  it("maps ESPN's Washington alias to the canonical NFL abbreviation", async () => {
    const washingtonFixture = structuredClone(fixture);
    washingtonFixture.events[0].competitions[0].competitors[0].team = {
      id: "28",
      abbreviation: "WSH",
      displayName: "Washington Commanders",
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(washingtonFixture), { status: 200 })));

    const [game] = await new EspnNflProvider("https://example.test/scoreboard").getWeekSchedule({ year: 2026, week: 1, seasonType: 2 });

    expect(game.home).toEqual(expect.objectContaining({ externalTeamId: "28", abbreviation: "WAS" }));
  });

  it("retries one transient failure", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error("timeout")).mockResolvedValueOnce(new Response(JSON.stringify({ events: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(new EspnNflProvider("https://example.test/scoreboard").getWeekSchedule({ year: 2026, week: 1, seasonType: 2 })).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects malformed provider data descriptively", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ events: [{ nope: true }] }), { status: 200 })));
    await expect(new EspnNflProvider("https://example.test/scoreboard").getWeekSchedule({ year: 2026, week: 1, seasonType: 2 })).rejects.toThrow(/unexpected format/);
  });
});
