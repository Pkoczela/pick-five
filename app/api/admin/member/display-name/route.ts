import { NextRequest } from "next/server";
import { z } from "zod";
import { friendlyDisplayNameError, leagueDisplayNameSchema } from "@/lib/auth/display-name";
import { redirectWith } from "@/lib/http/redirect";
import { createUserClient } from "@/lib/supabase/server";

const schema = z.object({ memberId: z.string().uuid(), displayName: leagueDisplayNameSchema });

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return redirectWith(request, "/admin/players", "error", parsed.error.issues[0]?.message ?? "Invalid display name.");
  const supabase = await createUserClient();
  const { error } = await supabase.rpc("update_league_display_name", { p_member_id: parsed.data.memberId, p_display_name: parsed.data.displayName });
  if (error) return redirectWith(request, "/admin/players", "error", friendlyDisplayNameError(error.message));
  return redirectWith(request, "/admin/players", "notice", "Display name updated.");
}
