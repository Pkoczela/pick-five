import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadLive } from "@/lib/data/live";
import { sampleLeagueContext } from "@/lib/preview/sample";
import { defaultPreviewState } from "@/lib/preview/state";

const mocks = vi.hoisted(() => ({ from: vi.fn(), feed: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createUserClient: async () => ({ from: mocks.from }) }));
vi.mock("@/lib/data/live-feed", () => ({ loadLiveFeed: mocks.feed }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("not found"); } }));
const context = sampleLeagueContext(defaultPreviewState);
let status: string, leagueId: string, lockAt: string, testLock: boolean;
const calls: string[] = [];
const game = { id: "game", external_event_id: "event", kickoff_at: "2026-10-18T17:00:00Z", status: "SCHEDULED", home_score: null, away_score: null, score_override: false, home_team: { abbreviation: "MIA" }, away_team: { abbreviation: "BUF" } };
beforeEach(() => {
  vi.clearAllMocks(); calls.length = 0; status = "LOCKED"; leagueId = context.leagueId; lockAt = "2026-01-01T00:00:00Z"; testLock = false;
  mocks.feed.mockResolvedValue({ observedAt: "2026-10-18T18:00:00Z", games: [{ externalEventId: "event", status: "IN_PROGRESS", detail: "Q3 · 6:42", home: { abbreviation: "MIA", score: 17 }, away: { abbreviation: "BUF", score: 21 } }] });
  mocks.from.mockImplementation((table: string) => {
    calls.push(table);
    const data = table === "weeks" ? { id: "week", nfl_week: 6, season_type: 2, status, lock_at: lockAt, test_lock_active: testLock, season: { league_id: leagueId, year: 2026 } } : [{ id: "entry", tiebreaker_points: 40, league_member: { id: context.memberId, display_name: "Alex" }, picks: [{ id: "pick", result: "PENDING", selected_side: "HOME", selected_team: { abbreviation: "MIA" }, submitted_line: { home_spread: 3.5 }, game }] }];
    // Deliberately exposes no mutation/RPC methods: any database write fails the test.
    const response = { data, error: null };
    const chain: Record<string, unknown> = { then: (resolve: (value: unknown) => unknown) => Promise.resolve(response).then(resolve), maybeSingle: async () => response };
    for (const method of ["select", "eq", "in"]) chain[method] = () => chain;
    return chain;
  });
});
describe("read-only production live loader", () => {
  it("loads the correct NFL week and adds scores without grading pending picks", async () => {
    const data = await loadLive(context, "week");
    expect(mocks.feed).toHaveBeenCalledWith({ year: 2026, week: 6, seasonType: 2 });
    expect(data.feed?.status).toBe("fresh");
    expect(data.entries[0].picks[0]).toMatchObject({ spread: 3.5, result: "PENDING", game: { homeScore: 17, awayScore: 21, status: "IN_PROGRESS", detail: "Q3 · 6:42" } });
  });
  it("does not query entries or ESPN before lock", async () => {
    status = "OPEN"; lockAt = "2099-01-01T00:00:00Z";
    expect(await loadLive(context, "week")).toMatchObject({ entries: [], poll: true });
    expect(calls).toEqual(["weeks"]); expect(mocks.feed).not.toHaveBeenCalled();
  });
  it("blocks another league and draft weeks before querying entries or ESPN", async () => {
    leagueId = "another-league";
    await expect(loadLive(context, "week")).rejects.toThrow("not found");
    leagueId = context.leagueId; status = "DRAFT";
    await expect(loadLive(context, "week")).rejects.toThrow("not found");
    expect(calls).toEqual(["weeks", "weeks"]); expect(mocks.feed).not.toHaveBeenCalled();
  });
  it("does not overlay real scores during a commissioner locked-board test", async () => {
    testLock = true;
    expect((await loadLive(context, "week")).feed).toBeUndefined(); expect(mocks.feed).not.toHaveBeenCalled();
  });
  it("marks failed and missing provider data as delayed without inventing scores", async () => {
    mocks.feed.mockRejectedValueOnce(new Error("timeout"));
    const failed = await loadLive(context, "week");
    expect(failed.feed?.status).toBe("unavailable");
    expect(failed.entries[0].picks[0].game?.homeScore).toBeNull();
    mocks.feed.mockResolvedValue({ games: [], observedAt: "2026-10-18T18:00:00Z" });
    expect((await loadLive(context, "week")).feed?.status).toBe("partial");
  });
});
