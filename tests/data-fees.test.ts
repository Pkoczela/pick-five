import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadDashboard } from "@/lib/data/dashboard";
import { loadPayments, loadPlayers, loadResults } from "@/lib/data/admin";
import { loadPicks } from "@/lib/data/picks";
import { sampleLeagueContext } from "@/lib/preview/sample";
import { defaultPreviewState } from "@/lib/preview/state";

const db = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
const cookieGet = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ createUserClient: async () => db }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => { throw new Error("Unexpected privileged access"); } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: cookieGet }) }));
const context = sampleLeagueContext(defaultPreviewState);
const week = { id: "week", nfl_week: 6, status: "OPEN", lock_at: "2099-01-01T00:00:00Z", season: { league_id: context.leagueId }, default_entry_fee_cents: 1000, contribution_override_cents: null, rollover_in_cents: 2000 };

function query(rows: unknown) {
  const result = { data: rows, error: null, count: 1 };
  const chain: Record<string, unknown> = { then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve) };
  for (const method of ["select", "eq", "neq", "in", "order", "limit"]) chain[method] = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(async () => ({ ...result, data: Array.isArray(rows) ? rows[0] ?? null : rows }));
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  db.from.mockImplementation((table: string) => query({
    seasons: [{ id: "season", year: 2026 }], weeks: [week],
    league_members: [{ id: context.memberId, display_name: "Alex", active: true, role: "OWNER" }],
    payments: [{ league_member_id: context.memberId, status: "PARTIAL", expected_cents: 3000, received_cents: 500 }],
    entries: [], games: [], weekly_player_results: [], league_invites: [{ code_hint: "hint" }],
  }[table] ?? []));
  db.rpc.mockImplementation(async (name: string) => ({ data: name === "week_calculated_contribution" ? 3000 : 1, error: null }));
  cookieGet.mockImplementation((name: string) => ({ value: name === "pick-five-invite-league" ? "another-league" : "SECRET-CODE" }));
});

describe("real page loaders preserve recorded fees", () => {
  it("loads a catch-up jackpot and personal fee on the dashboard", async () => {
    const data = await loadDashboard(context);
    expect(data.week).toMatchObject({ jackpotCents: 5000, entryFeeCents: 3000, baseFeeCents: 1000 });
    expect(data.week?.jackpotBasis).toContain("$20 catch-up");
    expect(data.inviteCode).toBeUndefined();
    expect(db.rpc).toHaveBeenCalledWith("week_calculated_contribution", { p_week_id: "week" });
  });
  it("uses recorded amounts for partial payments", async () => {
    expect((await loadPayments(context, {})).members[0]).toMatchObject({ status: "PARTIAL", expectedCents: 3000, receivedCents: 500 });
  });
  it("uses the same contribution for commissioner payout defaults", async () => {
    expect((await loadResults(context, {})).week?.jackpotCents).toBe(5000);
  });
  it("shows the player's assessed fee before submitting picks", async () => {
    expect(await loadPicks(context, "week")).toMatchObject({ entryFeeCents: 3000, baseFeeCents: 1000 });
  });
  it("does not show another league's rotated invite on the players page", async () => {
    expect((await loadPlayers(context, {})).rotatedCode).toBeUndefined();
  });
  it("does not silently invent a zero or base-only jackpot on RPC failure", async () => {
    db.rpc.mockResolvedValue({ data: null, error: { message: "Unavailable" } });
    await expect(loadDashboard(context)).rejects.toThrow("contribution");
    await expect(loadResults(context, {})).rejects.toThrow("contribution");
  });
});
