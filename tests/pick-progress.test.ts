import { describe, expect, it } from "vitest";
import { pickProgress, type GameSnapshot } from "@/lib/domain/pick-progress";
import { summarizeLiveEntry } from "@/lib/domain/live-pool";
import { sampleLive } from "@/lib/preview/sample";
import { defaultPreviewState } from "@/lib/preview/state";

const game: GameSnapshot = { id: "game", away: "BUF", home: "MIA", awayScore: 21, homeScore: 17, selectedSide: "AWAY", status: "IN_PROGRESS", detail: "Q3 · 6:42" };
describe("live pick progress", () => {
  it.each([[-3.5, "covering"], [-4.5, "trailing"], [-4, "tied"]])("grades the provisional spread %s", (spread, tone) => {
    expect(pickProgress({ result: "PENDING", spread, game }).tone).toBe(tone);
  });
  it("uses the selected home side, including underdog spreads", () => {
    expect(pickProgress({ result: "PENDING", spread: 4.5, game: { ...game, selectedSide: "HOME" } }).tone).toBe("covering");
  });
  it.each([['CORRECT', 'covered'], ['INCORRECT', 'missed'], ['PUSH', 'push'], ['VOID', 'push']] as const)("official %s overrides the live projection", (result, tone) => {
    expect(pickProgress({ result, spread: -10, game }).tone).toBe(tone);
  });
  it("does not guess for missing scores or grade an ungraded final", () => {
    expect(pickProgress({ result: "PENDING", spread: 0, game: { ...game, homeScore: null } }).tone).toBe("upcoming");
    expect(pickProgress({ result: "PENDING", spread: 0, game: { ...game, status: "FINAL" } }).label).toBe("Awaiting grading");
  });
  it("does not eliminate a pending, currently trailing pick", () => {
    expect(summarizeLiveEntry(["CORRECT", "PENDING", "PENDING", "PENDING", "PENDING"]).aliveForFive).toBe(true);
  });
  it("sample snapshots agree with final results and are consistent across players", () => {
    const board = sampleLive({ ...defaultPreviewState, scenario: "Final" }, "sample-week-6");
    expect(board.simulate).toBe(false);
    for (const entry of board.entries) for (const pick of entry.picks) {
      const projection = pickProgress({ ...pick, result: "PENDING", game: { ...pick.game!, status: "IN_PROGRESS" } });
      expect(projection.tone).toBe(pick.result === "CORRECT" ? "covering" : pick.result === "PUSH" ? "tied" : "trailing");
    }
  });
});
