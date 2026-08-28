export type SimulatedSide = "HOME" | "AWAY";

export type SimulationEntry = {
  id: string;
  picks: Array<{ gameId: string; selectedSide: SimulatedSide }>;
};

export type SimulationMode = "FIVE_ZERO" | "NO_WINNER";

export function buildSimulatedAtsResults(
  gameIds: string[],
  entries: SimulationEntry[],
  mode: SimulationMode,
  targetEntryId?: string,
) {
  if (entries.length === 0) throw new Error("At least one entry is required");
  const assignment = new Map<string, SimulatedSide>();

  if (mode === "FIVE_ZERO") {
    const target = entries.find((entry) => entry.id === targetEntryId);
    if (!target || target.picks.length !== 5) throw new Error("Choose a complete five-pick entry");
    for (const pick of target.picks) assignment.set(pick.gameId, pick.selectedSide);
  } else if (!eliminateEveryEntry(entries, assignment, 0)) {
    throw new Error("No no-winner result combination could be generated");
  }

  for (const gameId of gameIds) if (!assignment.has(gameId)) assignment.set(gameId, "HOME");
  return assignment;
}

export function simulatedFinalScore(side: SimulatedSide, homeSpread: number, requestedTotal?: number) {
  if (requestedTotal !== undefined) {
    for (let homeScore = 0; homeScore <= requestedTotal; homeScore += 1) {
      const awayScore = requestedTotal - homeScore;
      if (covers(side, homeScore, awayScore, homeSpread)) return { homeScore, awayScore };
    }
  }

  const awayScore = 20;
  const homeScore = side === "HOME"
    ? Math.max(0, Math.floor(awayScore - homeSpread) + 1)
    : Math.max(0, Math.ceil(awayScore - homeSpread) - 1);
  return { homeScore, awayScore };
}

function eliminateEveryEntry(entries: SimulationEntry[], assignment: Map<string, SimulatedSide>, entryIndex: number): boolean {
  if (entryIndex >= entries.length) return true;
  const entry = entries[entryIndex];
  if (entry.picks.some((pick) => assignment.get(pick.gameId) && assignment.get(pick.gameId) !== pick.selectedSide)) {
    return eliminateEveryEntry(entries, assignment, entryIndex + 1);
  }

  for (const pick of entry.picks) {
    const losingSide = opposite(pick.selectedSide);
    const existing = assignment.get(pick.gameId);
    if (existing && existing !== losingSide) continue;
    if (!existing) assignment.set(pick.gameId, losingSide);
    if (eliminateEveryEntry(entries, assignment, entryIndex + 1)) return true;
    if (!existing) assignment.delete(pick.gameId);
  }
  return false;
}

function opposite(side: SimulatedSide): SimulatedSide {
  return side === "HOME" ? "AWAY" : "HOME";
}

function covers(side: SimulatedSide, homeScore: number, awayScore: number, homeSpread: number) {
  const adjustedHome = homeScore + homeSpread;
  return side === "HOME" ? adjustedHome > awayScore : adjustedHome < awayScore;
}
