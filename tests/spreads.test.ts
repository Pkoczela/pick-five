import { describe, expect, it } from "vitest";
import { parseOfficialLineUpdates } from "@/lib/domain/spreads";

const gameA = "11111111-1111-4111-8111-111111111111";
const gameB = "22222222-2222-4222-8222-222222222222";

describe("bulk official line parsing", () => {
  it("pairs every game with its submitted spread", () => {
    expect(parseOfficialLineUpdates([gameA, gameB], ["-3.5", "2"])).toEqual([
      { game_id: gameA, home_spread: -3.5 },
      { game_id: gameB, home_spread: 2 },
    ]);
  });

  it("rejects a non-half-point spread", () => {
    expect(() => parseOfficialLineUpdates([gameA], ["-3.25"])).toThrow();
  });

  it("rejects mismatched or duplicate games", () => {
    expect(() => parseOfficialLineUpdates([gameA], ["-3.5", "2"])).toThrow("do not match");
    expect(() => parseOfficialLineUpdates([gameA, gameA], ["-3.5", "2"])).toThrow("more than once");
  });
});
