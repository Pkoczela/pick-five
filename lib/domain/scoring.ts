import type { AtsResult, EntryScore, PickResult, Side } from "./types";

export function calculateAtsResult(
  homeScore: number,
  awayScore: number,
  homeSpread: number,
): Exclude<AtsResult, "PENDING" | "VOID"> {
  assertScore(homeScore, "homeScore");
  assertScore(awayScore, "awayScore");
  assertFinite(homeSpread, "homeSpread");

  // Convert to half-points so supported NFL lines are evaluated without
  // floating-point equality surprises.
  const homeScoreInHalfPoints = homeScore * 2;
  const awayScoreInHalfPoints = awayScore * 2;
  const spreadInHalfPoints = Math.round(homeSpread * 2);

  if (Math.abs(homeSpread * 2 - spreadInHalfPoints) > Number.EPSILON) {
    throw new RangeError("homeSpread must use whole-point or half-point precision");
  }

  const adjustedHome = homeScoreInHalfPoints + spreadInHalfPoints;
  if (adjustedHome > awayScoreInHalfPoints) return "HOME";
  if (adjustedHome < awayScoreInHalfPoints) return "AWAY";
  return "PUSH";
}

export function scorePick(selectedSide: Side, atsResult: AtsResult): PickResult {
  if (atsResult === "PENDING") return "PENDING";
  if (atsResult === "PUSH") return "PUSH";
  if (atsResult === "VOID") return "VOID";
  return selectedSide === atsResult ? "CORRECT" : "INCORRECT";
}

export function summarizeEntry(results: PickResult[]): EntryScore {
  const summary = {
    correctCount: 0,
    incorrectCount: 0,
    pushCount: 0,
    voidCount: 0,
    pendingCount: 0,
  };

  for (const result of results) {
    switch (result) {
      case "CORRECT": summary.correctCount += 1; break;
      case "INCORRECT": summary.incorrectCount += 1; break;
      case "PUSH": summary.pushCount += 1; break;
      case "VOID": summary.voidCount += 1; break;
      case "PENDING": summary.pendingCount += 1; break;
    }
  }

  return {
    ...summary,
    isFiveAndZero: results.length === 5 && summary.correctCount === 5,
    isAlive:
      results.length === 5 &&
      summary.incorrectCount === 0 &&
      summary.pushCount === 0 &&
      summary.voidCount === 0,
  };
}

function assertScore(value: number, name: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer`);
  }
}

function assertFinite(value: number, name: string) {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
}
