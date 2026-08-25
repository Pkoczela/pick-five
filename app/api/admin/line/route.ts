import { NextRequest } from "next/server";
import { z } from "zod";
import { createUserClient } from "@/lib/supabase/server";
import { redirectWith } from "@/lib/http/redirect";

const schema = z.object({ gameId: z.uuid(), homeSpread: z.coerce.number().multipleOf(0.5), reason: z.string().optional() });
export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return redirectWith(request, "/admin/weeks", "error", "Spread must use whole or half points.");
  const supabase = await createUserClient();
  const { error } = await supabase.rpc("set_official_line", { p_game_id: parsed.data.gameId, p_home_spread: parsed.data.homeSpread, p_reason: parsed.data.reason || null });
  if (error) return redirectWith(request, "/admin/weeks", "error", error.message);
  return redirectWith(request, "/admin/weeks", "notice", "Official line saved.");
}
