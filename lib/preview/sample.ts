import "server-only";
import type { PickGame } from "@/components/pick-form";
import type { AdminOverviewData } from "@/components/views/admin/overview-view";
import type { AuditData } from "@/components/views/admin/audit-view";
import type { PaymentsData } from "@/components/views/admin/payments-view";
import type { PlayersData } from "@/components/views/admin/players-view";
import type { ResultsData } from "@/components/views/admin/results-view";
import type { SubmissionsData } from "@/components/views/admin/submissions-view";
import type { WeeksData } from "@/components/views/admin/weeks-view";
import type { DashboardData } from "@/components/views/dashboard-view";
import type { HistoryData } from "@/components/views/history-view";
import type { LeaguesData } from "@/components/views/leagues-view";
import type { LiveData } from "@/components/views/live-view";
import type { PicksData } from "@/components/views/picks-view";
import type { StandingsData } from "@/components/views/standings-view";
import type { LeagueContext } from "@/lib/auth/context";
import { sortBoard, summarizeLiveEntry, type LivePickResult } from "@/lib/domain/live-pool";
import { computeStandings, summarizeSeason, type WeeklyResult } from "@/lib/domain/standings";
import type { PreviewEntry, PreviewState } from "@/lib/preview/state";

/*
 * A fictional league for the design preview. Every page renders its real view
 * component with this data, so what you see in the preview is what ships.
 */

type Side = "HOME" | "AWAY";
type Flash = { error?: string; notice?: string };

const LEAGUE_ID = "sample-league";
const WEEK_ID = "sample-week-6";
const WEEK_NUMBER = 6;
const FEE_CENTS = 1000;
const people = ["Alex Morgan", "Jordan Lee", "Taylor Brooks", "Sam Rivera", "Casey Parker", "Riley Chen", "Drew Ellis", "Morgan Reed"];
const memberId = (index: number) => `sample-member-${index}`;
const ME = 0;
const WINNER = 1;
/** Morgan Reed never submits, so the "missing entry" states always have an example. */
const NO_SHOW = 7;
const PAID = new Set([0, 1, 2, 3, 5]);

const matchups: Array<[string, string, string, string, number]> = [
  ["BUF", "Buffalo Bills", "MIA", "Miami Dolphins", 3.5],
  ["GB", "Green Bay Packers", "MIN", "Minnesota Vikings", -2.5],
  ["KC", "Kansas City Chiefs", "BAL", "Baltimore Ravens", -1.5],
  ["DAL", "Dallas Cowboys", "PHI", "Philadelphia Eagles", -4.5],
  ["DET", "Detroit Lions", "CHI", "Chicago Bears", 6.5],
  ["SF", "San Francisco 49ers", "SEA", "Seattle Seahawks", 2.5],
  ["LAR", "Los Angeles Rams", "ARI", "Arizona Cardinals", 0],
  ["CIN", "Cincinnati Bengals", "PIT", "Pittsburgh Steelers", 3],
];
/** Against-the-spread winner of each game once it is decided. */
const atsWinners: Array<Side | "PUSH"> = ["AWAY", "HOME", "AWAY", "AWAY", "HOME", "HOME", "PUSH", "AWAY"];
const scores: Array<[number, number]> = [[27, 20], [24, 23], [20, 17], [31, 21], [17, 27], [14, 24], [23, 23], [24, 20]];

type Phase = "EMPTY" | "OPEN" | "LOCKED" | "LIVE" | "FINAL";
function phase(state: PreviewState): Phase {
  switch (state.scenario) {
    case "Empty": return "EMPTY";
    case "Locked": return "LOCKED";
    case "Live": return "LIVE";
    case "Final": return "FINAL";
    default: return "OPEN";
  }
}

const HOUR = 60 * 60 * 1000;
function lockAt(state: PreviewState) {
  const offset = { EMPTY: 48, OPEN: 48, LOCKED: -2, LIVE: -26, FINAL: -120 }[phase(state)];
  return new Date(Math.round((Date.now() + offset * HOUR) / (15 * 60 * 1000)) * 15 * 60 * 1000);
}

function games(state: PreviewState): PickGame[] {
  const lock = lockAt(state).getTime();
  // Thursday night, a Sunday slate, then the Monday tiebreaker game.
  const kickoffOffsets = [5, 65 * 60, 65 * 60, 65 * 60, 68 * 60 + 25, 68 * 60 + 25, 72 * 60, 89 * 60];
  return matchups.map(([away, awayName, home, homeName, spread], index) => ({
    id: `sample-game-${index}`,
    kickoffAt: new Date(lock + kickoffOffsets[index] * 60 * 1000).toISOString(),
    away: { abbreviation: away, displayName: awayName },
    home: { abbreviation: home, displayName: homeName },
    homeSpread: spread,
  }));
}

function isDecided(state: PreviewState, gameIndex: number) {
  const current = phase(state);
  return current === "FINAL" || (current === "LIVE" && gameIndex < 4);
}

const sampleEntry: PreviewEntry = { picks: { "sample-game-0": "AWAY", "sample-game-1": "HOME", "sample-game-3": "HOME", "sample-game-4": "HOME", "sample-game-5": "AWAY" }, tiebreaker: 44 };

function ownEntry(state: PreviewState): PreviewEntry | null {
  if (phase(state) === "EMPTY") return null;
  if (state.entry) return state.entry;
  return state.scenario === "Open" ? null : sampleEntry;
}

/** Every submitted entry for the current week; index matches `people`. */
function entries(state: PreviewState): Array<{ person: number; entry: PreviewEntry }> {
  const result: Array<{ person: number; entry: PreviewEntry }> = [];
  const own = ownEntry(state);
  if (own) result.push({ person: ME, entry: own });
  for (let person = 1; person < people.length; person += 1) {
    if (person === NO_SHOW) continue;
    const picks: Record<string, Side> = {};
    for (let k = 0; k < 5; k += 1) {
      const gameIndex = person === WINNER ? k : (person + k * 2) % matchups.length;
      if (picks[`sample-game-${gameIndex}`]) continue;
      const winner = atsWinners[gameIndex] === "PUSH" ? "HOME" : atsWinners[gameIndex];
      const right = person === WINNER || (person + k) % 3 !== 0;
      picks[`sample-game-${gameIndex}`] = right ? winner as Side : winner === "HOME" ? "AWAY" : "HOME";
    }
    // Fill to exactly five with untouched games, deterministically.
    for (let gameIndex = 0; Object.keys(picks).length < 5; gameIndex += 1) {
      if (!picks[`sample-game-${gameIndex}`]) picks[`sample-game-${gameIndex}`] = "HOME";
    }
    result.push({ person, entry: { picks, tiebreaker: 38 + person * 3 } });
  }
  return result;
}

function pickResult(state: PreviewState, gameIndex: number, side: Side): LivePickResult {
  if (!isDecided(state, gameIndex)) return "PENDING";
  const winner = atsWinners[gameIndex];
  return winner === "PUSH" ? "PUSH" : winner === side ? "CORRECT" : "INCORRECT";
}

// ---------------------------------------------------------------- history

const pastWeeks = [
  { number: 1, winner: ME as number | null, payoutCents: 8000, rolloverCents: 0 },
  { number: 2, winner: null, payoutCents: 0, rolloverCents: 8000 },
  { number: 3, winner: 2, payoutCents: 16000, rolloverCents: 0 },
  { number: 4, winner: null, payoutCents: 0, rolloverCents: 8000 },
  { number: 5, winner: WINNER, payoutCents: 16000, rolloverCents: 0 },
];

function weeklyResults(state: PreviewState): WeeklyResult[] {
  if (phase(state) === "EMPTY") return [];
  const results: WeeklyResult[] = pastWeeks.flatMap((week) => people.map((_, person) => ({
    league_member_id: memberId(person),
    week_id: `sample-week-${week.number}`,
    correct_count: week.winner === person ? 5 : 1 + ((person * 3 + week.number * 2) % 4),
    is_winner: week.winner === person,
    winnings_cents: week.winner === person ? week.payoutCents : 0,
  })));
  if (phase(state) === "FINAL") {
    for (const { person, entry } of entries(state)) {
      const correct = Object.entries(entry.picks).filter(([gameId, side]) => pickResult(state, Number(gameId.split("-").at(-1)), side) === "CORRECT").length;
      results.push({ league_member_id: memberId(person), week_id: WEEK_ID, correct_count: correct, is_winner: person === WINNER, winnings_cents: person === WINNER ? jackpotCents(state) : 0 });
    }
  }
  return results;
}

function jackpotCents(state: PreviewState) {
  return entries(state).length * FEE_CENTS;
}

const members = people.map((name, index) => ({ id: memberId(index), display_name: name }));

// ---------------------------------------------------------------- pages

export function sampleLeagueContext(state: PreviewState): LeagueContext {
  return { userId: "sample-user", memberId: memberId(ME), displayName: people[ME], role: state.role, leagueId: LEAGUE_ID, leagueName: "Sunday Social", leagueCount: 2 };
}

export function sampleDashboard(state: PreviewState): DashboardData {
  const current = phase(state);
  const standings = computeStandings(members, weeklyResults(state));
  const own = standings.find((row) => row.id === memberId(ME));
  const finalWeeks = sampleHistory(state).weeks;
  const last = finalWeeks[0];
  const entry = ownEntry(state);
  const count = entries(state).length;
  return {
    leagueName: "Sunday Social",
    isAdmin: state.role !== "PLAYER",
    week: current === "EMPTY" ? null : {
      id: WEEK_ID,
      number: WEEK_NUMBER,
      statusLabel: { OPEN: "Open", LOCKED: "Locked", LIVE: "Locked", FINAL: "Final" }[current],
      locked: current !== "OPEN",
      final: current === "FINAL",
      lockAt: lockAt(state).toISOString(),
      jackpotCents: jackpotCents(state),
      jackpotBasis: `${count} ${count === 1 ? "entry" : "entries"} × $10`,
      entry: entry ? { locked: current !== "OPEN", submittedAt: new Date(lockAt(state).getTime() - 30 * HOUR).toISOString() } : null,
      submittedCount: count,
      memberCount: people.length,
    },
    season: own && own.weeks ? { correct: own.correct, rank: own.rank, players: standings.length } : null,
    lastWeek: last ? { id: last.id, number: last.number, winners: last.winners, payoutCents: last.payoutCents, rolloverCents: last.rolloverCents } : null,
  };
}

export function samplePicks(state: PreviewState, { forOtherPlayer = false } = {}): PicksData {
  const entry = forOtherPlayer ? entries({ ...state, scenario: "Submitted" }).find(({ person }) => person === WINNER)?.entry ?? null : ownEntry(state);
  const sampleGames = games(state);
  return {
    weekId: WEEK_ID,
    weekNumber: WEEK_NUMBER,
    lockAt: lockAt(state).toISOString(),
    locked: phase(state) !== "OPEN",
    games: sampleGames,
    initialPicks: entry?.picks ?? {},
    initialTiebreaker: entry?.tiebreaker ?? null,
    tiebreakerLabel: `${sampleGames[7].away.displayName} at ${sampleGames[7].home.displayName}`,
  };
}

export function sampleLive(state: PreviewState, weekId: string): LiveData {
  const pastNumber = Number(weekId.match(/^sample-week-(\d)$/)?.[1]);
  // History links open earlier weeks: show them as a finished board.
  const boardState: PreviewState = pastNumber && pastNumber < WEEK_NUMBER ? { ...state, scenario: "Final", entry: null } : state;
  const current = phase(boardState);
  const boardEntries = entries(boardState).map(({ person, entry }) => {
    const picks = Object.entries(entry.picks)
      .map(([gameId, side]) => ({ gameIndex: Number(gameId.split("-").at(-1)), side }))
      .sort((a, b) => a.gameIndex - b.gameIndex)
      .map(({ gameIndex, side }) => {
        const [away, , home, , spread] = matchups[gameIndex];
        return { id: `${person}-${gameIndex}`, team: side === "HOME" ? home : away, spread: side === "HOME" ? spread : -spread, result: pickResult(boardState, gameIndex, side) };
      });
    const summary = summarizeLiveEntry(picks.map((pick) => pick.result));
    return { id: `entry-${person}`, name: people[person], own: person === ME, tiebreaker: entry.tiebreaker, alive: summary.aliveForFive, correct: summary.correct, picks };
  });
  return {
    week: { id: weekId, number: pastNumber || WEEK_NUMBER, lockAt: lockAt(boardState).toISOString(), locked: current !== "OPEN" && current !== "EMPTY", final: current === "FINAL", testLock: false },
    entries: sortBoard(boardEntries),
  };
}

export function sampleStandings(state: PreviewState): StandingsData {
  const results = weeklyResults(state);
  return { leagueName: "Sunday Social", ownMemberId: memberId(ME), rows: computeStandings(members, results), summary: summarizeSeason(results) };
}

export function sampleHistory(state: PreviewState): HistoryData {
  if (phase(state) === "EMPTY") return { leagueName: "Sunday Social", weeks: [] };
  const weeks = pastWeeks.map((week) => ({ id: `sample-week-${week.number}`, season: 2026, number: week.number, winners: week.winner === null ? [] : [people[week.winner]], payoutCents: week.payoutCents, rolloverCents: week.rolloverCents }));
  if (phase(state) === "FINAL") weeks.push({ id: WEEK_ID, season: 2026, number: WEEK_NUMBER, winners: [people[WINNER]], payoutCents: jackpotCents(state), rolloverCents: 0 });
  return { leagueName: "Sunday Social", weeks: weeks.reverse() };
}

export function sampleLeagues(state: PreviewState): Omit<LeaguesData, "error" | "notice"> {
  return {
    memberships: [
      { id: memberId(ME), leagueId: LEAGUE_ID, leagueName: "Sunday Social", role: state.role, displayName: people[ME] },
      { id: "sample-member-office", leagueId: "sample-league-office", leagueName: "Office Pick’em", role: "PLAYER", displayName: "Alex M." },
    ],
    activeLeagueId: LEAGUE_ID,
    profileName: people[ME],
  };
}

// ---------------------------------------------------------------- commissioner

function weekStatus(state: PreviewState) {
  return { EMPTY: "DRAFT", OPEN: "OPEN", LOCKED: "LOCKED", LIVE: "LOCKED", FINAL: "FINAL" }[phase(state)];
}

export function sampleAdminOverview(state: PreviewState): AdminOverviewData {
  const status = weekStatus(state);
  return {
    leagueName: "Sunday Social",
    week: { number: phase(state) === "EMPTY" ? 1 : WEEK_NUMBER, status, statusLabel: status[0] + status.slice(1).toLowerCase(), submitted: entries(state).length, members: people.length, paid: PAID.size },
  };
}

export function sampleWeeks(state: PreviewState, flash: Flash): WeeksData {
  const empty = phase(state) === "EMPTY";
  return {
    ...flash,
    leagueName: "Sunday Social",
    seasonYear: 2026,
    week: { id: WEEK_ID, number: empty ? 1 : WEEK_NUMBER, seasonType: 2, status: weekStatus(state), lockAt: empty ? null : lockAt(state).toISOString(), testLockActive: false },
    // A fresh draft has the schedule imported but some lines still missing.
    games: games(state).map((game, index) => ({ id: game.id, kickoffAt: game.kickoffAt, away: game.away.abbreviation, home: game.home.abbreviation, homeSpread: empty && index > 4 ? null : game.homeSpread })),
  };
}

export function samplePayments(state: PreviewState, flash: Flash): PaymentsData {
  return {
    ...flash,
    week: phase(state) === "EMPTY" ? null : { id: WEEK_ID, number: WEEK_NUMBER, feeCents: FEE_CENTS },
    members: people.map((name, index) => ({ id: memberId(index), name, paid: PAID.has(index) })),
  };
}

export function sampleSubmissions(state: PreviewState): SubmissionsData {
  const submitted = new Map(entries(state).map(({ person }) => [person, true]));
  return {
    week: phase(state) === "EMPTY" ? null : { id: WEEK_ID, number: WEEK_NUMBER },
    members: people.map((name, index) => ({
      id: memberId(index), name, paid: PAID.has(index), submitted: submitted.has(index),
      submittedAt: submitted.has(index) ? new Date(lockAt(state).getTime() - (20 + index * 7) * HOUR).toISOString() : null,
    })),
  };
}

export function samplePlayers(state: PreviewState, flash: Flash): PlayersData {
  return {
    ...flash,
    leagueId: LEAGUE_ID,
    isOwner: state.role === "OWNER",
    currentMemberId: memberId(ME),
    inviteHint: "Q7XZ",
    members: people.map((name, index) => ({ id: memberId(index), name, role: index === ME ? "OWNER" : index === 2 ? "COMMISSIONER" : "PLAYER", active: index !== 6 || true })),
  };
}

export function sampleResults(state: PreviewState, flash: Flash): ResultsData {
  const current = phase(state);
  if (current === "EMPTY") return { ...flash, seasonYear: 2026, week: null, laterReopenedWeeks: 0, games: [], tied: [], simulationEntries: [] };
  const final = current === "FINAL";
  return {
    ...flash,
    seasonYear: 2026,
    week: { id: WEEK_ID, number: WEEK_NUMBER, seasonType: 2, status: weekStatus(state), testLockActive: false, payoutCents: final ? jackpotCents(state) : 0, rolloverOutCents: 0, jackpotCents: jackpotCents(state) },
    laterReopenedWeeks: 0,
    games: games(state).map((game, index) => {
      const decided = isDecided(state, index);
      return { id: game.id, away: game.away.abbreviation, home: game.home.abbreviation, awayScore: decided ? scores[index][0] : null, homeScore: decided ? scores[index][1] : null, status: decided ? "FINAL" : current === "OPEN" ? "SCHEDULED" : "IN_PROGRESS", ats: decided ? atsWinners[index] : null };
    }),
    tied: [],
    simulationEntries: [],
  };
}

export function sampleAudit(state: PreviewState): AuditData {
  const now = Date.now();
  const at = (hoursAgo: number) => new Date(now - hoursAgo * HOUR).toISOString();
  const events = [
    { id: "a1", type: "WEEK_PUBLISHED", entity: "week", reason: "Week 6 lines reviewed", createdAt: at(60) },
    { id: "a2", type: "OFFICIAL_LINE_SAVED", entity: "official_line", reason: "Opening lines", createdAt: at(62) },
    { id: "a3", type: "SCHEDULE_IMPORTED", entity: "week", reason: null, createdAt: at(64) },
    { id: "a4", type: "PAYMENT_MARKED_PAID", entity: "payment", reason: "Venmo", createdAt: at(70) },
    { id: "a5", type: "WEEK_FINALIZED", entity: "week", reason: "Week 5 · Jordan Lee 5–0", createdAt: at(150) },
  ];
  if (phase(state) === "FINAL") events.unshift({ id: "a0", type: "WEEK_FINALIZED", entity: "week", reason: "Week 6 · Jordan Lee 5–0", createdAt: at(2) });
  return { events: phase(state) === "EMPTY" ? [] : events };
}
