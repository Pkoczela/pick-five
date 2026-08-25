import { NextRequest, NextResponse } from "next/server";
import { createInviteCode, hashInviteCode } from "@/lib/auth/credentials";
import { setInviteCodeCookie } from "@/lib/auth/invite-code-cookie";
import { createUserClient } from "@/lib/supabase/server";
import { redirectWith } from "@/lib/http/redirect";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const leagueId = String(form.get("leagueId") ?? "");
  const code = createInviteCode();
  const supabase = await createUserClient();
  const { error } = await supabase.rpc("rotate_league_invite", { p_league_id: leagueId, p_code_hash: hashInviteCode(code), p_code_hint: code.slice(-4) });
  if (error) return redirectWith(request, "/admin/players", "error", error.message);
  const response = NextResponse.redirect(new URL("/admin/players", request.url), 303);
  setInviteCodeCookie(response, request, code);
  return response;
}
