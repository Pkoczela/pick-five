import "server-only";
import { EspnNflProvider } from "@/lib/providers/espn";
import type { ExternalGame } from "@/lib/providers/types";

type Snapshot = { games: ExternalGame[]; observedAt: string };
// Only public NFL data is shared. Never cache memberships, entries or picks.
// Per-instance coalescing reduces upstream traffic; no stale-on-error fallback.
const cache = new Map<string, { expires: number; value: Promise<Snapshot> }>();
export async function loadLiveFeed(params: { year: number; week: number; seasonType: number }): Promise<Snapshot> {
  const key = `${params.year}:${params.seasonType}:${params.week}`;
  const existing = cache.get(key);
  if (existing && existing.expires > Date.now()) return existing.value;
  if (cache.size >= 16) cache.delete(cache.keys().next().value!);
  const value = new EspnNflProvider().getWeekSchedule(params).then(games => ({ games, observedAt: new Date().toISOString() }));
  const item = { expires: Date.now() + 20_000, value };
  cache.set(key, item);
  try { return await value; }
  catch (error) { if (cache.get(key) === item) cache.delete(key); throw error; }
}
