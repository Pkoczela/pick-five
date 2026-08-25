import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createUserClient } from "@/lib/supabase/server";

const schema = z.object({
  weekId: z.uuid(),
  tiebreakerPoints: z.number().int().min(0).max(200),
  picks: z.array(z.object({ gameId: z.uuid(), selectedSide: z.enum(["HOME", "AWAY"]) })).length(5),
});

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid entry" }, { status: 400 });
  const supabase = await createUserClient();
  const { data, error } = await supabase.rpc("submit_entry", {
    p_week_id: parsed.data.weekId,
    p_tiebreaker_points: parsed.data.tiebreakerPoints,
    p_picks: parsed.data.picks.map((pick) => ({ game_id: pick.gameId, selected_side: pick.selectedSide })),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: error.message.includes("locked") ? 409 : 400 });
  return NextResponse.json({ entryId: data });
}
