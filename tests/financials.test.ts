import { describe, expect, it } from "vitest";
import { calculateEntryFeeDue, calculateWeeklyFinancials, validatePayoutAllocations } from "@/lib/domain/financials";

describe("calculateEntryFeeDue", () => {
  it("adds every fee missed during the active rollover run", () => {
    expect(calculateEntryFeeDue(1000, [1000, 1500])).toBe(3500);
  });

  it("charges only the current fee after a winner resets the run", () => {
    expect(calculateEntryFeeDue(1000, [])).toBe(1000);
  });
});

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

  it("uses catch-up fee obligations in the calculated contribution", () => {
    expect(calculateWeeklyFinancials({
      participatingEntries: 3,
      defaultEntryFeeCents: 1000,
      calculatedContributionCents: 5000,
      rolloverInCents: 6000,
      resolution: "NO_WINNER",
    })).toMatchObject({
      calculatedContributionCents: 5000,
      finalContributionCents: 5000,
      availableJackpotCents: 11000,
      rolloverOutCents: 11000,
    });
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
