import { describe, expect, it } from "vitest";
import { friendlyDisplayNameError, leagueDisplayNameSchema } from "@/lib/auth/display-name";

describe("league display names", () => {
  it("trims a valid pool name", () => {
    expect(leagueDisplayNameSchema.parse("  Pat K  ")).toBe("Pat K");
  });

  it("rejects a blank pool name", () => {
    expect(leagueDisplayNameSchema.safeParse("   ").success).toBe(false);
  });

  it("turns database collisions into a useful suggestion", () => {
    expect(friendlyDisplayNameError("duplicate key violates league_members_display_name_unique")).toContain("last initial");
  });
});
