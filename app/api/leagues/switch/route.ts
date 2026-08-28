import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { setActiveLeagueCookie } from "@/lib/auth/active-league";
import { redirectWith } from "@/lib/http/redirect";
import { createUserClient } from "@/lib/supabase/server";

const schema = z.object({ leagueId: z.string().uuid() });

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return redirectWith(request, "/leagues", "error", "Invalid league selection.");
  const supabase = await createUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirectWith(request, "/login", "error", "Log in to continue.");
  const { data: membership } = await supabase.from("league_members").select("id").eq("league_id", parsed.data.leagueId).eq("user_id", user.id).eq("active", true).maybeSingle();
  if (!membership) return redirectWith(request, "/leagues", "error", "You do not have access to that league.");
  const response = NextResponse.redirect(new URL("/dashboard", request.url), 303);
  setActiveLeagueCookie(response, request, parsed.data.leagueId);
  return response;
}
