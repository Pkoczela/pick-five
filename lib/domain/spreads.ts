import { z } from "zod";

const gameIdSchema = z.string().uuid();
const spreadSchema = z.coerce.number().finite().multipleOf(0.5, "Spreads must use whole or half points");

export type OfficialLineUpdate = { game_id: string; home_spread: number };

export function parseOfficialLineUpdates(gameIds: string[], spreadValues: string[]): OfficialLineUpdate[] {
  if (gameIds.length !== spreadValues.length) throw new Error("The submitted games and spreads do not match.");
  if (gameIds.length === 0 || gameIds.length > 64) throw new Error("No valid spreads were submitted.");

  const updates = gameIds.map((gameId, index) => ({
    game_id: gameIdSchema.parse(gameId),
    home_spread: spreadSchema.parse(spreadValues[index]),
  }));
  if (new Set(updates.map((update) => update.game_id)).size !== updates.length) {
    throw new Error("A game was submitted more than once.");
  }
  return updates;
}
