import { describe, expect, it } from "vitest";
import { calculateFrozenLockAt, isEffectivelyLocked } from "@/lib/domain/deadline";

describe("calculateFrozenLockAt", () => {
  it("uses five minutes before the earliest kickoff", () => {
    expect(calculateFrozenLockAt([
      new Date("2026-10-11T20:25:00Z"),
      new Date("2026-10-08T00:15:00Z"),
      new Date("2026-10-11T17:00:00Z"),
    ]).toISOString()).toBe("2026-10-08T00:10:00.000Z");
  });
});

describe("isEffectivelyLocked", () => {
  it("locks at the exact server deadline", () => {
    const lockAt = new Date("2026-10-08T00:10:00Z");
    expect(isEffectivelyLocked("OPEN", lockAt, new Date("2026-10-08T00:09:59Z"))).toBe(false);
    expect(isEffectivelyLocked("OPEN", lockAt, new Date("2026-10-08T00:10:00Z"))).toBe(true);
  });
});
