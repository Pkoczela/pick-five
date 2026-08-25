const FIVE_MINUTES_MS = 5 * 60 * 1000;

export function calculateFrozenLockAt(kickoffDates: Date[]): Date {
  if (kickoffDates.length === 0) throw new Error("At least one selectable game is required");

  const timestamps = kickoffDates.map((date) => {
    const timestamp = date.getTime();
    if (!Number.isFinite(timestamp)) throw new RangeError("Kickoff date is invalid");
    return timestamp;
  });

  return new Date(Math.min(...timestamps) - FIVE_MINUTES_MS);
}

export function isEffectivelyLocked(status: string, lockAt: Date, now = new Date()) {
  return status !== "OPEN" || now.getTime() >= lockAt.getTime();
}
