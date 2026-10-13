import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadHistory } from "@/lib/data/history";
import { loadLive } from "@/lib/data/live";
import { sampleHistory, sampleLeagueContext, sampleLive } from "@/lib/preview/sample";
import { defaultPreviewState } from "@/lib/preview/state";

const db = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createUserClient: async () => db }));
const context = sampleLeagueContext(defaultPreviewState);
const calls: Array<[string, string, unknown[]]> = [];
let status: string;
let failure: string | undefined;
const result = (id: string, own: boolean, winner: boolean) => ({
  entry_id: id, week_id: "week", league_member_id: own ? context.memberId : id,
  correct_count: winner ? 5 : 3, incorrect_count: winner ? 0 : 1, push_count: winner ? 0 : 1, void_count: 0,
  tiebreaker_prediction: 42, tiebreaker_actual: 40, tiebreaker_error: 2,
  is_five_and_zero: winner, is_winner: winner, winnings_cents: winner ? 6000 : 0,
  league_member: { display_name: id },
});

beforeEach(() => {
  calls.length = 0; status = "FINAL"; failure = undefined;
  db.from.mockImplementation((table: string) => {
    const rows: Record<string, unknown[]> = {
      seasons: [{ id: "season", year: 2026 }],
      weeks: [{ id: "week", season_id: "season", nfl_week: 3, status, lock_at: "2026-01-01T00:00:00Z", season: { league_id: context.leagueId }, finalized_at: "2026-01-05T00:00:00Z", payout_cents: 6000, rollover_out_cents: 0 }],
      weekly_player_results: [result("winner", false, true), result("me", true, false)],
      entries: ["winner", "me"].map(id => ({ id, tiebreaker_points: 42, league_member: { id: id === "me" ? context.memberId : id, display_name: id }, picks: [
        { id: `${id}-pick`, selected_side: "AWAY", result: "CORRECT", selected_team: { abbreviation: "BUF" }, submitted_line: { home_spread: 3.5 }, game: { kickoff_at: "2026-01-01T01:00:00Z", official_lines: [{ home_spread: 9, is_current: true }] } },
      ] })),
    };
    const response = { data: rows[table] ?? [], error: failure === table ? { message: "unavailable" } : null };
    const chain: Record<string, unknown> = { then: (resolve: (value: unknown) => unknown) => Promise.resolve(response).then(resolve) };
    for (const method of ["select", "eq", "in", "order"]) chain[method] = (...args: unknown[]) => { calls.push([table, method, args]); return chain; };
    chain.maybeSingle = async () => ({ ...response, data: response.data[0] ?? null });
    return chain;
  });
});

describe("main history features survive redesign integration", () => {
  it("preserves own-first order, final details, payouts, and submitted spreads", async () => {
    const history = await loadHistory(context);
    expect(history.weeks[0]).toMatchObject({ winners: ["winner"], payoutCents: 6000, finalizedAt: "2026-01-05T00:00:00Z" });
    const entries = history.weeks[0].entries;
    expect(entries.map(entry => entry.id)).toEqual(["me", "winner"]);
    expect(entries[0]).toMatchObject({ own: true, tiebreaker: 42, finalResult: { actual: 40, error: 2, pushes: 1, incorrect: 1 } });
    expect(entries[1].finalResult).toMatchObject({ winner: true, winningsCents: 6000 });
    expect(entries[0].picks[0].spread).toBe(-3.5);
    expect(calls).toContainEqual(["seasons", "eq", ["league_id", context.leagueId]]);
    expect(calls).toContainEqual(["weeks", "eq", ["status", "FINAL"]]);
  });
  it("shows identical finalized details on the full week board", async () => {
    const board = await loadLive(context, "week");
    expect(board.entries).toEqual((await loadHistory(context, "week")).weeks[0].entries);
    expect(calls).toContainEqual(["weeks", "eq", ["id", "week"]]);
  });
  it("uses submitted lines on non-final locked boards too", async () => {
    status = "LOCKED";
    expect((await loadLive(context, "week")).entries[0].picks[0].spread).toBe(-3.5);
    const selection = calls.find(([table, method]) => table === "entries" && method === "select")!;
    expect(selection[2][0]).toContain("picks_submitted_official_line_id_fkey");
  });
  it("surfaces unavailable historical results instead of an empty success", async () => {
    failure = "weekly_player_results";
    await expect(loadHistory(context)).rejects.toThrow("Unable to load historical entries");
  });
  it("sample archive and full boards share the same final details", () => {
    for (const week of sampleHistory(defaultPreviewState).weeks) {
      expect(week.entries).toEqual(sampleLive(defaultPreviewState, week.id).entries);
      expect(week.entries[0].own).toBe(true);
      expect(week.entries.filter(entry => entry.finalResult?.winner).map(entry => entry.name)).toEqual(week.winners);
      expect(week.entries.reduce((total, entry) => total + (entry.finalResult?.winningsCents ?? 0), 0)).toBe(week.payoutCents);
    }
  });
});
