export type LivePickResult = "PENDING" | "CORRECT" | "INCORRECT" | "PUSH" | "VOID";

export function summarizeLiveEntry(results: LivePickResult[]) {
  return {
    correct: results.filter((result) => result === "CORRECT").length,
    pending: results.filter((result) => result === "PENDING").length,
    aliveForFive: results.length === 5 && results.every((result) => result === "CORRECT" || result === "PENDING"),
  };
}

/** Own entry first, then entries still alive, then by correct picks and name. */
export function sortBoard<T extends { own: boolean; alive: boolean; correct: number; name: string }>(entries: T[]) {
  return [...entries].sort((a, b) => Number(b.own) - Number(a.own) || Number(b.alive) - Number(a.alive) || b.correct - a.correct || a.name.localeCompare(b.name));
}
