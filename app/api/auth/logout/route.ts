import { NextRequest, NextResponse } from "next/server";
import { createUserClient } from "@/lib/supabase/server";
import { clearActiveLeagueCookie } from "@/lib/auth/active-league";

export async function POST(request: NextRequest) {
  const supabase = await createUserClient();
  await supabase.auth.signOut();
  const response = NextResponse.redirect(new URL("/", request.url), 303);
  clearActiveLeagueCookie(response);
  return response;
}
