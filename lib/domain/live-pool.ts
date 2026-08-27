export type LivePickResult = "PENDING" | "CORRECT" | "INCORRECT" | "PUSH" | "VOID";

export function summarizeLiveEntry(results: LivePickResult[]) {
  return {
    correct: results.filter((result) => result === "CORRECT").length,
    pending: results.filter((result) => result === "PENDING").length,
    aliveForFive: results.length === 5 && results.every((result) => result === "CORRECT" || result === "PENDING"),
  };
}
