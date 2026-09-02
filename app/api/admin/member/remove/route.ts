import { NextRequest } from "next/server";
import { z } from "zod";
import { redirectWith } from "@/lib/http/redirect";
import { createUserClient } from "@/lib/supabase/server";

const schema = z.object({ memberId: z.string().uuid() });

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return redirectWith(request, "/admin/players", "error", "Invalid member removal request.");
  const supabase = await createUserClient();
  const { error } = await supabase.rpc("remove_league_member", { p_member_id: parsed.data.memberId });
  if (error) return redirectWith(request, "/admin/players", "error", error.message);
  return redirectWith(request, "/admin/players", "notice", "Member removed from this league. Their account was not deleted.");
}
