import { describe, expect, it } from "vitest";
import { calculateAtsResult, scorePick, summarizeEntry } from "@/lib/domain/scoring";

describe("calculateAtsResult", () => {
  it.each([
    [27, 20, -3.5, "HOME"],
    [21, 20, -3.5, "AWAY"],
    [20, 24, 6.5, "HOME"],
    [20, 23, 3, "PUSH"],
    [24, 20, 0, "HOME"],
    [17, 20, 0, "AWAY"],
  ] as const)("scores %i-%i at %f as %s", (home, away, spread, expected) => {
    expect(calculateAtsResult(home, away, spread)).toBe(expected);
  });

  it("rejects unsupported spread precision", () => {
    expect(() => calculateAtsResult(20, 17, -3.25)).toThrow(/half-point/);
  });
});

describe("scorePick", () => {
  it.each([
    ["HOME", "HOME", "CORRECT"],
    ["AWAY", "AWAY", "CORRECT"],
    ["HOME", "AWAY", "INCORRECT"],
    ["AWAY", "HOME", "INCORRECT"],
    ["HOME", "PUSH", "PUSH"],
    ["AWAY", "VOID", "VOID"],
    ["HOME", "PENDING", "PENDING"],
  ] as const)("scores %s against %s as %s", (side, result, expected) => {
    expect(scorePick(side, result)).toBe(expected);
  });
});

describe("summarizeEntry", () => {
  it("recognizes five correct picks", () => {
    expect(summarizeEntry(Array(5).fill("CORRECT"))).toMatchObject({
      correctCount: 5,
      isFiveAndZero: true,
      isAlive: true,
    });
  });

  it("does not treat four correct plus a push as five and zero", () => {
    expect(summarizeEntry(["CORRECT", "CORRECT", "CORRECT", "CORRECT", "PUSH"])).toMatchObject({
      correctCount: 4,
      pushCount: 1,
      isFiveAndZero: false,
      isAlive: false,
    });
  });
});
