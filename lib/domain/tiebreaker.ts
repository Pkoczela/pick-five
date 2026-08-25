import type { FiveAndZeroCandidate, WinnerResolution } from "./types";

export function resolveWinner(
  candidates: FiveAndZeroCandidate[],
  actualTotal: number | null,
): WinnerResolution {
  if (candidates.length === 0) return { type: "NO_WINNER" };
  if (candidates.length === 1) {
    return { type: "SOLE_WINNER", memberId: candidates[0].memberId, error: null };
  }

  if (actualTotal === null) return { type: "NOT_READY", reason: "TIEBREAKER_PENDING" };
  assertNonNegativeInteger(actualTotal, "actualTotal");

  const ranked = candidates
    .map((candidate) => {
      assertNonNegativeInteger(candidate.prediction, "prediction");
      return { ...candidate, error: Math.abs(candidate.prediction - actualTotal) };
    })
    .sort((a, b) => a.error - b.error || a.memberId.localeCompare(b.memberId));

  const bestError = ranked[0].error;
  const tied = ranked.filter((candidate) => candidate.error === bestError);

  if (tied.length === 1) {
    return { type: "TIEBREAKER_WINNER", memberId: tied[0].memberId, error: bestError };
  }

  return {
    type: "TIE_REQUIRES_COMMISSIONER",
    memberIds: tied.map((candidate) => candidate.memberId),
    error: bestError,
  };
}

function assertNonNegativeInteger(value: number, name: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer`);
  }
}
