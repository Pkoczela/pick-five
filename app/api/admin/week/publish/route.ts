import { NextRequest } from "next/server";
import { z } from "zod";
import { createUserClient } from "@/lib/supabase/server";
import { redirectWith } from "@/lib/http/redirect";

const schema = z.object({ weekId: z.uuid(), tiebreakerGameId: z.uuid(), unpaidEntriesEligible: z.enum(["true", "false"]).transform((value) => value === "true") });
export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return redirectWith(request, "/admin/weeks", "error", "Choose a tiebreaker game and eligibility policy.");
  const supabase = await createUserClient();
  const { data, error } = await supabase.rpc("publish_week", { p_week_id: parsed.data.weekId, p_tiebreaker_game_id: parsed.data.tiebreakerGameId, p_unpaid_entries_eligible: parsed.data.unpaidEntriesEligible });
  if (error) return redirectWith(request, "/admin/weeks", "error", error.message);
  const lock = new Intl.DateTimeFormat("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: "America/New_York", timeZoneName: "short" }).format(new Date(data));
  return redirectWith(request, "/admin/weeks", "notice", `Week published. Picks lock ${lock}.`);
}
