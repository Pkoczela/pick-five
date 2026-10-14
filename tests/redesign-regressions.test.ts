import { afterEach, describe, expect, it, vi } from "vitest";
import { inviteCodeForLeague, INVITE_CODE_COOKIE, INVITE_LEAGUE_COOKIE } from "@/lib/auth/invite-code-cookie";
import { calculateWeeklyFinancials } from "@/lib/domain/financials";
import { paymentTotals } from "@/lib/domain/payments";
import { defaultPreviewState, PREVIEW_COOKIE, serializePreviewState } from "@/lib/preview/state";
import { clearPreviewState, readPreviewState, writePreviewState, saveSampleEntry } from "@/lib/preview/client";
import { sampleHistory, sampleLive, samplePicks, sampleStandings } from "@/lib/preview/sample";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("league-scoped invite codes", () => {
  const store = (league?: string, code?: string) => ({ get: (name: string) => {
    const value = name === INVITE_LEAGUE_COOKIE ? league : name === INVITE_CODE_COOKIE ? code : undefined;
    return value === undefined ? undefined : { value };
  } });
  it("only displays the code for its matching league", () => {
    expect(inviteCodeForLeague(store("a", "ABC"), "a")).toBe("ABC");
    expect(inviteCodeForLeague(store("a", "ABC"), "b")).toBeUndefined();
    expect(inviteCodeForLeague(store(undefined, "ABC"), "a")).toBeUndefined();
    expect(inviteCodeForLeague(store("a"), "a")).toBeUndefined();
  });
});

describe("assessed fees", () => {
  it("includes catch-up in jackpots and respects explicit overrides", () => {
    const input = { participatingEntries: 2, defaultEntryFeeCents: 1000, calculatedContributionCents: 4000, rolloverInCents: 2000, resolution: "WINNER" as const };
    expect(calculateWeeklyFinancials(input).payoutCents).toBe(6000);
    expect(calculateWeeklyFinancials({ ...input, contributionOverrideCents: 0 }).payoutCents).toBe(2000);
    expect(calculateWeeklyFinancials({ ...input, calculatedContributionCents: 0 }).payoutCents).toBe(2000);
    expect(() => calculateWeeklyFinancials({ ...input, calculatedContributionCents: -1 })).toThrow();
  });
  it("totals actual receipts, partial payments, catch-up, and waivers", () => {
    expect(paymentTotals([
      { status: "PAID", expectedCents: 3000, receivedCents: 3000 },
      { status: "PARTIAL", expectedCents: 2000, receivedCents: 500 },
      { status: "UNPAID", expectedCents: 1000, receivedCents: 0 },
      { status: "WAIVED", expectedCents: 1000, receivedCents: 0 },
      { status: "PAID", expectedCents: 1000, receivedCents: 1500 },
    ])).toEqual({ collected: 5000, outstanding: 2500 });
  });
});

describe("preview form identity", () => {
  it("does not let a pending save undo Reset", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("document", { cookie: `${PREVIEW_COOKIE}=${serializePreviewState(defaultPreviewState)}` });
    const pending = saveSampleEntry({ picks: { "sample-game-0": "HOME" }, tiebreaker: 42 }, { persist: true });
    const rejection = expect(pending).rejects.toThrow("cancelled");
    clearPreviewState();
    await vi.advanceTimersByTimeAsync(400);
    await rejection;
    expect(readPreviewState().entry).toBeNull();
  });
  it("changes on scenario/reset, even an Open-to-Open reset, but not save/failure toggles", () => {
    vi.stubGlobal("document", { cookie: `${PREVIEW_COOKIE}=${serializePreviewState(defaultPreviewState)}` });
    const key = () => samplePicks(readPreviewState()).formRevision;
    const initial = key();
    writePreviewState({ failSaves: true });
    expect(key()).toBe(initial);
    writePreviewState({ entry: { picks: { "sample-game-0": "HOME" }, tiebreaker: 42 } });
    expect(key()).toBe(initial);
    clearPreviewState();
    expect(key()).not.toBe(initial);
    expect(samplePicks(readPreviewState()).initialPicks).toEqual({});
    const reset = key();
    writePreviewState({ scenario: "Submitted", entry: null });
    expect(key()).not.toBe(reset);
    expect(Object.keys(samplePicks(readPreviewState()).initialPicks)).toHaveLength(5);
  });
});

describe("historical preview consistency", () => {
  const state = { ...defaultPreviewState, scenario: "Live" as const };
  it.each([1, 2, 3, 4, 5])("week %i has the same winner on its board and recap", (number) => {
    const week = sampleHistory(state).weeks.find((week) => week.number === number)!;
    const board = sampleLive(state, week.id);
    expect(board.week.final).toBe(true);
    expect(board.simulate).toBe(false);
    expect(board.entries).toHaveLength(8);
    expect(board.entries.filter((entry) => entry.correct === 5).map((entry) => entry.name)).toEqual(week.winners);
    for (const entry of board.entries) {
      expect(entry.picks).toHaveLength(5);
      for (const pick of entry.picks) {
        const game = pick.game!;
        const margin = (game.selectedSide === "HOME" ? game.homeScore! - game.awayScore! : game.awayScore! - game.homeScore!) + pick.spread;
        expect(pick.result).toBe(margin > 0 ? "CORRECT" : margin < 0 ? "INCORRECT" : "PUSH");
      }
    }
  });
  it("season totals equal the sum of all historical cards", () => {
    const boards = sampleHistory(state).weeks.map((week) => sampleLive(state, week.id));
    for (const player of sampleStandings(state).rows) {
      expect(player.correct).toBe(boards.reduce((sum, board) => sum + board.entries.find((entry) => entry.name === player.name)!.correct, 0));
    }
  });
  it("historical cards ignore the current week's saved selections", () => {
    const withDraft = { ...state, entry: { picks: { "sample-game-0": "HOME" as const }, tiebreaker: 99 } };
    expect(sampleLive(withDraft, "sample-week-2").entries).toEqual(sampleLive(state, "sample-week-2").entries);
  });
});
