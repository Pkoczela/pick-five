import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { setActiveLeagueCookie } from "@/lib/auth/active-league";
import { hashInviteCode } from "@/lib/auth/credentials";
import { friendlyDisplayNameError, leagueDisplayNameSchema } from "@/lib/auth/display-name";
import { redirectWith } from "@/lib/http/redirect";
import { createUserClient } from "@/lib/supabase/server";

const schema = z.object({ inviteCode: z.string().min(6), displayName: leagueDisplayNameSchema });

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return redirectWith(request, "/leagues", "error", parsed.error.issues[0]?.message ?? "Invalid league details.");
  const supabase = await createUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirectWith(request, "/login", "error", "Log in to join another league.");
  try {
    const { data: leagueId, error } = await supabase.rpc("join_league_existing", { p_invite_code_hash: hashInviteCode(parsed.data.inviteCode), p_display_name: parsed.data.displayName });
    if (error || !leagueId) throw new Error(error?.message ?? "Could not join the league.");
    const response = NextResponse.redirect(new URL("/dashboard", request.url), 303);
    setActiveLeagueCookie(response, request, String(leagueId));
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not join the league.";
    return redirectWith(request, "/leagues", "error", friendlyDisplayNameError(message));
  }
}
