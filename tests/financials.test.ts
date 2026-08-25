import { describe, expect, it } from "vitest";
import { calculateWeeklyFinancials, validatePayoutAllocations } from "@/lib/domain/financials";

describe("calculateWeeklyFinancials", () => {
  it("pays the contribution to a winner", () => {
    expect(calculateWeeklyFinancials({
      participatingEntries: 10,
      defaultEntryFeeCents: 1000,
      rolloverInCents: 0,
      resolution: "WINNER",
    })).toEqual({
      calculatedContributionCents: 10000,
      finalContributionCents: 10000,
      availableJackpotCents: 10000,
      payoutCents: 10000,
      rolloverOutCents: 0,
    });
  });

  it("carries contribution and prior rollover when nobody wins", () => {
    expect(calculateWeeklyFinancials({
      participatingEntries: 10,
      defaultEntryFeeCents: 1700,
      rolloverInCents: 17000,
      resolution: "NO_WINNER",
    })).toMatchObject({ payoutCents: 0, rolloverOutCents: 34000 });
  });

  it("uses an explicit contribution override including zero", () => {
    expect(calculateWeeklyFinancials({
      participatingEntries: 10,
      defaultEntryFeeCents: 1700,
      contributionOverrideCents: 0,
      rolloverInCents: 5000,
      resolution: "NO_WINNER",
    })).toMatchObject({ finalContributionCents: 0, rolloverOutCents: 5000 });
  });
});

describe("validatePayoutAllocations", () => {
  it("accepts a balanced split", () => {
    expect(() => validatePayoutAllocations(10000, [
      { memberId: "a", amountCents: 5000 },
      { memberId: "b", amountCents: 5000 },
    ])).not.toThrow();
  });

  it("rejects an unbalanced split", () => {
    expect(() => validatePayoutAllocations(10000, [
      { memberId: "a", amountCents: 4000 },
      { memberId: "b", amountCents: 5000 },
    ])).toThrow(/equal/);
  });
});
