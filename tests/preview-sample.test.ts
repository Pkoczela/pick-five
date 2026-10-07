import { describe, expect, it } from "vitest";
import { defaultPreviewState, parsePreviewState, serializePreviewState, type PreviewState } from "@/lib/preview/state";
import { sampleDashboard, sampleHistory, sampleLive, samplePicks, sampleStandings, sampleSubmissions } from "@/lib/preview/sample";

const state = (patch: Partial<PreviewState>): PreviewState => ({ ...defaultPreviewState, ...patch });

describe("preview state cookie", () => {
  it("round-trips and rejects malformed values", () => {
    const value = state({ scenario: "Live", role: "PLAYER", failSaves: true, entry: { picks: { g1: "HOME" }, tiebreaker: 40 } });
    expect(parsePreviewState(serializePreviewState(value))).toEqual(value);
    expect(parsePreviewState("not json")).toEqual(defaultPreviewState);
    expect(parsePreviewState(encodeURIComponent(JSON.stringify({ scenario: "Hacked", entry: { picks: { g1: "DROP" }, tiebreaker: 1 } })))).toEqual(defaultPreviewState);
  });
});

describe("sample league", () => {
  it("starts open with no entry, and a saved entry shows up everywhere", () => {
    expect(sampleDashboard(state({})).week).toMatchObject({ locked: false, entry: null });
    const entry = { picks: { "sample-game-0": "AWAY" as const, "sample-game-2": "HOME" as const, "sample-game-3": "AWAY" as const, "sample-game-5": "HOME" as const, "sample-game-7": "HOME" as const }, tiebreaker: 41 };
    const saved = state({ entry });
    expect(samplePicks(saved).initialPicks).toEqual(entry.picks);
    expect(sampleDashboard(saved).week?.entry).not.toBeNull();
    expect(sampleSubmissions(saved).members[0]).toMatchObject({ name: "Alex Morgan", submitted: true });
  });

  it("only reveals picks once the week locks", () => {
    expect(sampleLive(state({ scenario: "Submitted" }), "sample-week-6").week.locked).toBe(false);
    const live = sampleLive(state({ scenario: "Live" }), "sample-week-6");
    expect(live.week.locked).toBe(true);
    expect(live.entries[0].own).toBe(true);
    expect(live.entries.every((entry) => entry.picks.length === 5)).toBe(true);
  });

  it("has exactly one 5–0 winner in the final week, matching history and standings", () => {
    const final = state({ scenario: "Final" });
    const winners = sampleLive(final, "sample-week-6").entries.filter((entry) => entry.alive);
    expect(winners.map((entry) => entry.name)).toEqual(["Jordan Lee"]);
    expect(sampleHistory(final).weeks[0]).toMatchObject({ number: 6, winners: ["Jordan Lee"] });
    expect(sampleStandings(final).summary.weeksCompleted).toBe(6);
  });

  it("empties every page in the Empty scenario", () => {
    const empty = state({ scenario: "Empty" });
    expect(sampleDashboard(empty)).toMatchObject({ week: null, lastWeek: null, season: null });
    expect(sampleHistory(empty).weeks).toEqual([]);
    expect(sampleStandings(empty).summary.weeksCompleted).toBe(0);
  });
});
