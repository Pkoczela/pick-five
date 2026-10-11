import "server-only";
import type { createUserClient } from "@/lib/supabase/server";

/** The database includes assessed catch-up fees, not just entry count × base fee. */
export async function loadContribution(client: Awaited<ReturnType<typeof createUserClient>>, weekId: string) {
  const { data, error } = await client.rpc("week_calculated_contribution", { p_week_id: weekId });
  if (error || data === null) throw new Error("Unable to load this week’s contribution.");
  const cents = Number(data);
  if (!Number.isSafeInteger(cents) || cents < 0) throw new Error("Invalid weekly contribution.");
  return cents;
}
