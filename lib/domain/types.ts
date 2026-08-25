export const SIDES = ["HOME", "AWAY"] as const;
export type Side = (typeof SIDES)[number];

export const ATS_RESULTS = ["HOME", "AWAY", "PUSH", "PENDING", "VOID"] as const;
export type AtsResult = (typeof ATS_RESULTS)[number];

export const PICK_RESULTS = ["PENDING", "CORRECT", "INCORRECT", "PUSH", "VOID"] as const;
export type PickResult = (typeof PICK_RESULTS)[number];

export type EntryScore = {
  correctCount: number;
  incorrectCount: number;
  pushCount: number;
  voidCount: number;
  pendingCount: number;
  isFiveAndZero: boolean;
  isAlive: boolean;
};

export type FiveAndZeroCandidate = {
  memberId: string;
  prediction: number;
};

export type WinnerResolution =
  | { type: "NOT_READY"; reason: "TIEBREAKER_PENDING" }
  | { type: "NO_WINNER" }
  | { type: "SOLE_WINNER"; memberId: string; error: null }
  | { type: "TIEBREAKER_WINNER"; memberId: string; error: number }
  | { type: "TIE_REQUIRES_COMMISSIONER"; memberIds: string[]; error: number };

export type FinancialResolution = "WINNER" | "NO_WINNER";

export type WeeklyFinancialInput = {
  participatingEntries: number;
  defaultEntryFeeCents: number;
  contributionOverrideCents?: number | null;
  rolloverInCents: number;
  resolution: FinancialResolution;
};

export type WeeklyFinancialResult = {
  calculatedContributionCents: number;
  finalContributionCents: number;
  availableJackpotCents: number;
  payoutCents: number;
  rolloverOutCents: number;
};
