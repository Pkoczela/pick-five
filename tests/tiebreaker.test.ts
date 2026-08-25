import { describe, expect, it } from "vitest";
import { resolveWinner } from "@/lib/domain/tiebreaker";

describe("resolveWinner", () => {
  it("returns no winner without a five-and-zero candidate", () => {
    expect(resolveWinner([], 51)).toEqual({ type: "NO_WINNER" });
  });

  it("returns a sole winner without requiring the tiebreaker total", () => {
    expect(resolveWinner([{ memberId: "a", prediction: 44 }], null)).toEqual({
      type: "SOLE_WINNER",
      memberId: "a",
      error: null,
    });
  });

  it("chooses the lowest absolute error", () => {
    expect(resolveWinner([
      { memberId: "a", prediction: 49 },
      { memberId: "b", prediction: 55 },
    ], 51)).toEqual({ type: "TIEBREAKER_WINNER", memberId: "a", error: 2 });
  });

  it("requires commissioner resolution for equal error", () => {
    expect(resolveWinner([
      { memberId: "a", prediction: 48 },
      { memberId: "b", prediction: 52 },
    ], 50)).toEqual({
      type: "TIE_REQUIRES_COMMISSIONER",
      memberIds: ["a", "b"],
      error: 2,
    });
  });
});
