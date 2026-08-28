import { describe, expect, it } from "vitest";
import { selectActiveMembership } from "@/lib/auth/membership-selection";

const memberships = [
  { id: "member-a", league: { id: "league-a" } },
  { id: "member-b", league: { id: "league-b" } },
];

describe("selectActiveMembership", () => {
  it("uses the remembered active league", () => {
    expect(selectActiveMembership(memberships, "league-b")?.id).toBe("member-b");
  });

  it("falls back safely when the remembered league is unavailable", () => {
    expect(selectActiveMembership(memberships, "removed-league")?.id).toBe("member-a");
  });

  it("returns null when the account has no active memberships", () => {
    expect(selectActiveMembership([], null)).toBeNull();
  });
});
