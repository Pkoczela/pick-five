import { describe, expect, it } from "vitest";
import { sortBoard, summarizeLiveEntry } from "@/lib/domain/live-pool";

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

describe("sortBoard", () => {
  it("puts your entry first, then live entries, then by correct picks and name", () => {
    const entry = (name: string, own: boolean, alive: boolean, correct: number) => ({ name, own, alive, correct });
    const sorted = sortBoard([entry("Zed", false, false, 4), entry("Amy", false, true, 2), entry("Bo", false, true, 3), entry("You", true, false, 0), entry("Al", false, true, 3)]);
    expect(sorted.map((row) => row.name)).toEqual(["You", "Al", "Bo", "Amy", "Zed"]);
  });
});
