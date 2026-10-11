import type { WeeklyFinancialInput, WeeklyFinancialResult } from "./types";

export function calculateEntryFeeDue(
  currentEntryFeeCents: number,
  priorWeeks: Array<{ entryFeeCents: number; entered: boolean }>,
) {
  assertCents(currentEntryFeeCents, "currentEntryFeeCents");
  const outstandingCatchUpCents = priorWeeks.reduce((outstanding, week, index) => {
    assertCents(week.entryFeeCents, `priorWeeks[${index}].entryFeeCents`);
    // A submitted entry is the point where all earlier missed fees in the
    // active rollover run were assessed. Only misses after that return remain.
    return week.entered ? 0 : safeAdd(outstanding, week.entryFeeCents);
  }, 0);
  return safeAdd(currentEntryFeeCents, outstandingCatchUpCents);
}

export function calculateWeeklyFinancials(input: WeeklyFinancialInput): WeeklyFinancialResult {
  assertCents(input.defaultEntryFeeCents, "defaultEntryFeeCents");
  assertCents(input.rolloverInCents, "rolloverInCents");
  if (!Number.isSafeInteger(input.participatingEntries) || input.participatingEntries < 0) {
    throw new RangeError("participatingEntries must be a non-negative safe integer");
  }

  if (input.calculatedContributionCents !== undefined) {
    assertCents(input.calculatedContributionCents, "calculatedContributionCents");
  }

  const calculatedContributionCents = input.calculatedContributionCents ?? safeMultiply(
    input.participatingEntries,
    input.defaultEntryFeeCents,
  );

  if (input.contributionOverrideCents !== null && input.contributionOverrideCents !== undefined) {
    assertCents(input.contributionOverrideCents, "contributionOverrideCents");
  }

  const finalContributionCents = input.contributionOverrideCents ?? calculatedContributionCents;
  const availableJackpotCents = safeAdd(input.rolloverInCents, finalContributionCents);
  const hasWinner = input.resolution === "WINNER";

  return {
    calculatedContributionCents,
    finalContributionCents,
    availableJackpotCents,
    payoutCents: hasWinner ? availableJackpotCents : 0,
    rolloverOutCents: hasWinner ? 0 : availableJackpotCents,
  };
}

export function validatePayoutAllocations(
  payoutCents: number,
  allocations: Array<{ memberId: string; amountCents: number }>,
) {
  assertCents(payoutCents, "payoutCents");
  if (new Set(allocations.map((allocation) => allocation.memberId)).size !== allocations.length) {
    throw new Error("Each member may have only one payout allocation");
  }

  const total = allocations.reduce((sum, allocation) => {
    assertCents(allocation.amountCents, "allocation.amountCents");
    return safeAdd(sum, allocation.amountCents);
  }, 0);

  if (total !== payoutCents) {
    throw new Error("Payout allocations must equal the finalized payout");
  }
}

function assertCents(value: number, name: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer`);
  }
}

function safeAdd(a: number, b: number) {
  const result = a + b;
  if (!Number.isSafeInteger(result)) throw new RangeError("Monetary calculation exceeds safe integer range");
  return result;
}

function safeMultiply(a: number, b: number) {
  const result = a * b;
  if (!Number.isSafeInteger(result)) throw new RangeError("Monetary calculation exceeds safe integer range");
  return result;
}
