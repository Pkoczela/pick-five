import { describe, expect, it } from "vitest";
import { buildSimulatedAtsResults, simulatedFinalScore, type SimulationEntry } from "@/lib/domain/simulation";

const entries: SimulationEntry[] = [
  { id: "pat", picks: [
    { gameId: "a", selectedSide: "HOME" }, { gameId: "b", selectedSide: "AWAY" },
    { gameId: "c", selectedSide: "HOME" }, { gameId: "d", selectedSide: "AWAY" },
    { gameId: "e", selectedSide: "HOME" },
  ] },
  { id: "ryan", picks: [
    { gameId: "a", selectedSide: "HOME" }, { gameId: "b", selectedSide: "HOME" },
    { gameId: "f", selectedSide: "AWAY" }, { gameId: "g", selectedSide: "HOME" },
    { gameId: "h", selectedSide: "AWAY" },
  ] },
];

describe("buildSimulatedAtsResults", () => {
  it("makes every target pick correct", () => {
    const results = buildSimulatedAtsResults(["a", "b", "c", "d", "e", "f", "g", "h"], entries, "FIVE_ZERO", "pat");
    expect(entries[0].picks.every((pick) => results.get(pick.gameId) === pick.selectedSide)).toBe(true);
  });

  it("gives every entry at least one incorrect pick in a no-winner scenario", () => {
    const results = buildSimulatedAtsResults(["a", "b", "c", "d", "e", "f", "g", "h"], entries, "NO_WINNER");
    for (const entry of entries) {
      expect(entry.picks.some((pick) => results.get(pick.gameId) !== pick.selectedSide)).toBe(true);
    }
  });
});

describe("simulatedFinalScore", () => {
  it("creates a score where the requested home side covers", () => {
    const score = simulatedFinalScore("HOME", -3.5);
    expect(score.homeScore - 3.5).toBeGreaterThan(score.awayScore);
  });

  it("honors the requested MNF total when a compatible score exists", () => {
    const score = simulatedFinalScore("AWAY", 2.5, 47);
    expect(score.homeScore + score.awayScore).toBe(47);
    expect(score.homeScore + 2.5).toBeLessThan(score.awayScore);
  });
});
