import { describe, expect, it } from "vitest";
import { summarizeLiveEntry } from "@/lib/domain/live-pool";

describe("summarizeLiveEntry", () => {
  it("keeps an entry alive while all settled picks are correct", () => {
    expect(summarizeLiveEntry(["CORRECT", "CORRECT", "PENDING", "PENDING", "PENDING"])).toEqual({
      correct: 2,
      pending: 3,
      aliveForFive: true,
    });
  });

  it.each(["INCORRECT", "PUSH", "VOID"] as const)("eliminates an entry after a %s", (result) => {
    expect(summarizeLiveEntry(["CORRECT", "CORRECT", "CORRECT", "CORRECT", result]).aliveForFive).toBe(false);
  });

  it("does not label an incomplete entry as alive", () => {
    expect(summarizeLiveEntry(["PENDING", "PENDING"]).aliveForFive).toBe(false);
  });
});
