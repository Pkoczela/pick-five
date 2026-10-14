import { describe, expect, it } from "vitest";
import { computeStandings, summarizeSeason, type WeeklyResult } from "@/lib/domain/standings";

const result = (member: string, week: string, correct: number, winnings = 0): WeeklyResult => ({ league_member_id: member, week_id: week, correct_count: correct, is_winner: winnings > 0, winnings_cents: winnings });
const members = [{ id: "a", display_name: "Avery" }, { id: "b", display_name: "Blake" }, { id: "c", display_name: "Casey" }, { id: "d", display_name: "Drew" }];

describe("computeStandings", () => {
  it("ranks by correct picks and lets tied players share a rank", () => {
    const rows = computeStandings(members, [result("a", "w1", 3), result("b", "w1", 5, 8000), result("c", "w1", 3), result("d", "w1", 1)]);
    expect(rows.map((row) => [row.name, row.rank])).toEqual([["Blake", 1], ["Avery", 2], ["Casey", 2], ["Drew", 4]]);
    expect(rows[0]).toMatchObject({ wins: 1, winningsCents: 8000, weeks: 1 });
  });

  it("breaks equal totals by per-week average", () => {
    const rows = computeStandings(members.slice(0, 2), [result("a", "w1", 4), result("a", "w2", 2), result("b", "w1", 6)]);
    expect(rows.map((row) => row.name)).toEqual(["Blake", "Avery"]);
    expect(rows.map((row) => row.rank)).toEqual([1, 2]);
  });

  it("includes members with no results at the bottom", () => {
    const rows = computeStandings(members.slice(0, 2), [result("b", "w1", 2)]);
    expect(rows.at(-1)).toMatchObject({ name: "Avery", correct: 0, weeks: 0, rank: 2 });
  });
});

describe("summarizeSeason", () => {
  it("counts distinct weeks, distinct winning weeks, and total payouts", () => {
    expect(summarizeSeason([result("a", "w1", 5, 4000), result("b", "w1", 5, 4000), result("a", "w2", 2), result("b", "w2", 3)]))
      .toEqual({ weeksCompleted: 2, perfectWeeks: 1, paidOutCents: 8000 });
  });
});
