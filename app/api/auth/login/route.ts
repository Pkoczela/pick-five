import { NextRequest, NextResponse } from "next/server";
import { loginSchema } from "@/lib/auth/schemas";
import { usernameToAuthEmail } from "@/lib/auth/credentials";
import { createUserClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const parsed = loginSchema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return redirectError(request, parsed.error.issues[0]?.message ?? "Invalid login");
  const supabase = await createUserClient();
  const { error } = await supabase.auth.signInWithPassword({ email: usernameToAuthEmail(parsed.data.username), password: parsed.data.password });
  if (error) return redirectError(request, "Incorrect username or password.");
  return NextResponse.redirect(new URL("/dashboard", request.url), 303);
}

function redirectError(request: NextRequest, message: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url, 303);
}
