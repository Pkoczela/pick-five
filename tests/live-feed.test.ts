import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { liveSnapshot, type StoredLiveGame } from "@/lib/domain/live-snapshot";
import { pickProgress } from "@/lib/domain/pick-progress";
import { retainLiveScores } from "@/lib/domain/retain-live-scores";
import { sampleLiveSnapshot } from "@/lib/preview/sample";
import { defaultPreviewState } from "@/lib/preview/state";
import type { ExternalGame } from "@/lib/providers/types";

const getWeekSchedule = vi.hoisted(() => vi.fn());
vi.mock("@/lib/providers/espn", () => ({ EspnNflProvider: class { getWeekSchedule = getWeekSchedule; } }));
const stored: StoredLiveGame = { id: "g", external_event_id: "event", kickoff_at: "2026-10-18T17:00:00Z", status: "SCHEDULED", home_score: null, away_score: null, score_override: false, home_team: { abbreviation: "MIA" }, away_team: { abbreviation: "BUF" } };
const external: ExternalGame = { externalSource: "ESPN", externalEventId: "event", kickoffAt: stored.kickoff_at, status: "IN_PROGRESS", detail: "Q3 · 6:42", home: { externalTeamId: "1", abbreviation: "MIA", displayName: "Miami", score: 17 }, away: { externalTeamId: "2", abbreviation: "BUF", displayName: "Buffalo", score: 21 } };
beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { vi.useRealTimers(); });

describe("display-only live snapshots", () => {
  it("maps scores and quarter/clock without changing official pick results", () => {
    const game = liveSnapshot(stored, "HOME", external);
    expect(game).toMatchObject({ homeScore: 17, awayScore: 21, detail: "Q3 · 6:42", source: "provider" });
    expect(pickProgress({ game, spread: 3.5, result: "PENDING" }).tone).toBe("trailing");
    expect(pickProgress({ game: { ...game, selectedSide: "AWAY" }, spread: -3.5, result: "PENDING" }).tone).toBe("covering");
    expect(pickProgress({ game, spread: 3.5, result: "CORRECT" }).tone).toBe("covered");
  });
  it("never overwrites commissioner score overrides", () => {
    expect(liveSnapshot({ ...stored, score_override: true, home_score: 30, away_score: 10 }, "HOME", external)).toMatchObject({ status: "FINAL", homeScore: 30, awayScore: 10, source: "override" });
  });
  it("rejects mismatched event IDs or teams", () => {
    expect(liveSnapshot(stored, "HOME", { ...external, externalEventId: "other" }).source).toBe("stored");
    expect(liveSnapshot(stored, "HOME", { ...external, home: { ...external.home, abbreviation: "NE" } }).source).toBe("stored");
  });
  it("does not grade a pending pick when the provider declares final", () => {
    const game = liveSnapshot(stored, "HOME", { ...external, status: "FINAL", detail: "Final" });
    expect(pickProgress({ game, spread: 3.5, result: "PENDING" }).label).toBe("Awaiting grading");
  });
  it("retains last provider scores on failure but accepts overrides and official grading", () => {
    const old = sampleLiveSnapshot({ ...defaultPreviewState, scenario: "Live" }, "sample-week-6", 0);
    const next = structuredClone(old);
    next.feed = { source: "Sample", status: "unavailable", observedAt: null };
    for (const entry of next.entries) for (const pick of entry.picks) if (pick.game?.source === "provider") { pick.game.source = "stored"; pick.game.homeScore = 0; pick.result = "CORRECT"; }
    const recovered = retainLiveScores(old, next);
    const pick = recovered.entries.flatMap(entry => entry.picks).find(pick => pick.game?.source === "provider")!;
    expect(pick.game?.homeScore).toBe(17);
    expect(pick.result).toBe("CORRECT");
    const override = structuredClone(next);
    for (const entry of override.entries) for (const pick of entry.picks) if (pick.game) pick.game.source = "override";
    expect(retainLiveScores(old, override).entries).toEqual(override.entries);
    const hidden = { ...next, week: { ...next.week, locked: false }, entries: [] };
    expect(retainLiveScores(old, hidden).entries).toEqual([]);
  });
  it("sample polling changes scores without altering picks or eligibility", () => {
    const state = { ...defaultPreviewState, scenario: "Live" as const };
    const first = sampleLiveSnapshot(state, "sample-week-6", 0);
    const second = sampleLiveSnapshot(state, "sample-week-6", 30_000);
    expect(first.entries).not.toEqual(second.entries);
    expect(first.entries.map(e => [e.alive, e.correct, e.picks.map(p => p.result)])).toEqual(second.entries.map(e => [e.alive, e.correct, e.picks.map(p => p.result)]));
    expect(sampleLiveSnapshot(defaultPreviewState, "sample-week-6").entries).toEqual([]);
  });
});

describe("public feed request coalescing", () => {
  it("coalesces requests and expires snapshots after 20 seconds", async () => {
    vi.useFakeTimers();
    getWeekSchedule.mockResolvedValue([external]);
    const { loadLiveFeed } = await import("@/lib/data/live-feed");
    const params = { year: 2026, week: 6, seasonType: 2 };
    const [a, b] = await Promise.all([loadLiveFeed(params), loadLiveFeed(params)]);
    expect(a).toEqual(b); expect(getWeekSchedule).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(21_000);
    await loadLiveFeed(params); expect(getWeekSchedule).toHaveBeenCalledTimes(2);
  });
  it("evicts errors so a subsequent request can recover", async () => {
    getWeekSchedule.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([external]);
    const { loadLiveFeed } = await import("@/lib/data/live-feed");
    const params = { year: 2026, week: 7, seasonType: 2 };
    await expect(loadLiveFeed(params)).rejects.toThrow("offline");
    await expect(loadLiveFeed(params)).resolves.toMatchObject({ games: [external] });
  });
});
