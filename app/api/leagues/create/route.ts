import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { setActiveLeagueCookie } from "@/lib/auth/active-league";
import { createInviteCode, hashInviteCode } from "@/lib/auth/credentials";
import { setInviteCodeCookie } from "@/lib/auth/invite-code-cookie";
import { redirectWith } from "@/lib/http/redirect";
import { createUserClient } from "@/lib/supabase/server";

const schema = z.object({ leagueName: z.string().trim().min(2).max(60), displayName: z.string().trim().min(2).max(40) });

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return redirectWith(request, "/leagues", "error", parsed.error.issues[0]?.message ?? "Invalid league details.");
  const supabase = await createUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirectWith(request, "/login", "error", "Log in to create another league.");
  const inviteCode = createInviteCode();
  const slug = `${slugify(parsed.data.leagueName)}-${crypto.randomUUID().slice(0, 6)}`;
  const { data: leagueId, error } = await supabase.rpc("create_additional_league", {
    p_name: parsed.data.leagueName,
    p_slug: slug,
    p_display_name: parsed.data.displayName,
    p_invite_code_hash: hashInviteCode(inviteCode),
    p_invite_code_hint: inviteCode.slice(-4),
  });
  if (error || !leagueId) return redirectWith(request, "/leagues", "error", error?.message ?? "Could not create the league.");
  const response = NextResponse.redirect(new URL("/dashboard", request.url), 303);
  setActiveLeagueCookie(response, request, String(leagueId));
  setInviteCodeCookie(response, request, inviteCode, String(leagueId));
  return response;
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "league";
}
