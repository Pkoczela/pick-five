export type WeeklyResult = { league_member_id: string; week_id: string; correct_count: number; is_winner: boolean; is_five_and_zero?: boolean; winnings_cents: number };
export type StandingsRow = { id: string; name: string; correct: number; weeks: number; wins: number; winningsCents: number; rank: number };

/** Season totals ranked by correct picks, then per-week average, then name. Ties share a rank. */
export function computeStandings(members: Array<{ id: string; display_name: string }>, results: WeeklyResult[]): StandingsRow[] {
  const totals = new Map<string, { correct: number; weeks: number; wins: number; winningsCents: number }>();
  for (const result of results) {
    const total = totals.get(result.league_member_id) ?? { correct: 0, weeks: 0, wins: 0, winningsCents: 0 };
    total.correct += result.correct_count;
    total.weeks += 1;
    total.wins += result.is_winner ? 1 : 0;
    total.winningsCents += result.winnings_cents;
    totals.set(result.league_member_id, total);
  }
  const average = (row: { correct: number; weeks: number }) => row.weeks ? row.correct / row.weeks : 0;
  const rows = members
    .map((member) => ({ id: member.id, name: member.display_name, ...(totals.get(member.id) ?? { correct: 0, weeks: 0, wins: 0, winningsCents: 0 }) }))
    .sort((a, b) => b.correct - a.correct || average(b) - average(a) || a.name.localeCompare(b.name));
  let rank = 0;
  return rows.map((row, index) => {
    const previous = rows[index - 1];
    if (!previous || previous.correct !== row.correct || average(previous) !== average(row)) rank = index + 1;
    return { ...row, rank };
  });
}

export function summarizeSeason(results: WeeklyResult[]) {
  const weeks = new Set(results.map((result) => result.week_id));
  const winningWeeks = new Set(results.filter((result) => result.is_winner).map((result) => result.week_id));
  return {
    weeksCompleted: weeks.size,
    perfectWeeks: winningWeeks.size,
    paidOutCents: results.reduce((total, result) => total + result.winnings_cents, 0),
  };
}
