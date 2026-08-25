import { NextRequest, NextResponse } from "next/server";
import { createLeagueSchema } from "@/lib/auth/schemas";
import { setInviteCodeCookie } from "@/lib/auth/invite-code-cookie";
import { createLeagueOwnerAccount } from "@/lib/auth/register";
import { createUserClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const parsed = createLeagueSchema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return redirectError(request, parsed.error.issues[0]?.message ?? "Invalid league details");
  try {
    const { email, inviteCode } = await createLeagueOwnerAccount(parsed.data);
    const supabase = await createUserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password: parsed.data.password });
    if (error) throw new Error("League created. Please log in.");
    const response = NextResponse.redirect(new URL("/dashboard", request.url), 303);
    setInviteCodeCookie(response, request, inviteCode);
    return response;
  } catch (error) {
    return redirectError(request, error instanceof Error ? error.message : "Could not create the league.");
  }
}

function redirectError(request: NextRequest, message: string) {
  const url = new URL("/create-league", request.url);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url, 303);
}
