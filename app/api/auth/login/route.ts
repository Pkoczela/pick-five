import { NextRequest, NextResponse } from "next/server";
import { loginSchema } from "@/lib/auth/schemas";
import { usernameToAuthEmail } from "@/lib/auth/credentials";
import { createUserClient } from "@/lib/supabase/server";
import { setActiveLeagueCookie } from "@/lib/auth/active-league";

export async function POST(request: NextRequest) {
  const parsed = loginSchema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return redirectError(request, parsed.error.issues[0]?.message ?? "Invalid login");
  const supabase = await createUserClient();
  const { error } = await supabase.auth.signInWithPassword({ email: usernameToAuthEmail(parsed.data.username), password: parsed.data.password });
  if (error) return redirectError(request, "Incorrect username or password.");
  const { data: { user } } = await supabase.auth.getUser();
  const { data: memberships } = user ? await supabase.from("league_members").select("league_id").eq("user_id", user.id).eq("active", true).order("created_at") : { data: null };
  const destination = memberships?.length === 1 ? "/dashboard" : "/leagues";
  const response = NextResponse.redirect(new URL(destination, request.url), 303);
  if (memberships?.length === 1) setActiveLeagueCookie(response, request, memberships[0].league_id);
  return response;
}

function redirectError(request: NextRequest, message: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url, 303);
}
