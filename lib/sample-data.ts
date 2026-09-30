import type { PickGame, PickSubmission } from "@/components/pick-form";

// Fictional schedule and people. Never fetched from a league or sports provider.
export const sampleGames: PickGame[] = [
  ["BUF", "Buffalo Bills", "MIA", "Miami Dolphins", 3.5],
  ["GB", "Green Bay Packers", "MIN", "Minnesota Vikings", -2.5],
  ["KC", "Kansas City Chiefs", "BAL", "Baltimore Ravens", -1.5],
  ["DAL", "Dallas Cowboys", "PHI", "Philadelphia Eagles", -4.5],
  ["DET", "Detroit Lions", "CHI", "Chicago Bears", 6.5],
  ["SF", "San Francisco 49ers", "SEA", "Seattle Seahawks", 2.5],
  ["LAR", "Los Angeles Rams", "ARI", "Arizona Cardinals", 0],
  ["CIN", "Cincinnati Bengals", "PIT", "Pittsburgh Steelers", 3],
].map(([away, awayName, home, homeName, spread], i) => ({ id: `sample-game-${i}`, kickoffAt: i === 0 ? "2026-10-08T00:20:00Z" : i === 7 ? "2026-10-13T00:15:00Z" : "2026-10-11T17:00:00Z", away: { abbreviation: String(away), displayName: String(awayName) }, home: { abbreviation: String(home), displayName: String(homeName) }, homeSpread: Number(spread) }));
export const sampleEntry: PickSubmission = { picks: { "sample-game-0": "AWAY", "sample-game-1": "HOME", "sample-game-2": "AWAY", "sample-game-3": "HOME", "sample-game-4": "AWAY" }, tiebreaker: 47 };
export const samplePeople = ["Alex Morgan", "Jordan Lee", "Taylor Brooks", "Sam Rivera", "Casey Parker", "Riley Chen", "Drew Ellis", "Morgan Reed"];
export const sampleDeadline = "2026-10-08T00:15:00Z";
