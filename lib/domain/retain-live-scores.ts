import type { LiveData } from "@/components/views/live-view";

/** Preserve the last provider snapshot when a later response only has old DB scores. */
export function retainLiveScores(previous: LiveData, next: LiveData): LiveData {
  if (previous.week.id !== next.week.id || !next.week.locked || next.week.final || !next.feed) return next;
  const games = new Map(previous.entries.flatMap(entry => entry.picks.flatMap(pick => pick.game ? [[pick.game.id, pick.game] as const] : [])));
  return { ...next, feed: { ...next.feed, observedAt: next.feed.observedAt ?? previous.feed?.observedAt ?? null }, entries: next.entries.map(entry => ({ ...entry, picks: entry.picks.map(pick => {
    const old = pick.game && games.get(pick.game.id);
    return old?.source === "provider" && pick.game?.source === "stored" ? { ...pick, game: { ...old, selectedSide: pick.game.selectedSide } } : pick;
  }) })) };
}
