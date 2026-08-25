import { NextRequest, NextResponse } from "next/server";
import { joinSchema } from "@/lib/auth/schemas";
import { createPlayerAccount } from "@/lib/auth/register";
import { createUserClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const parsed = joinSchema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return redirectError(request, parsed.error.issues[0]?.message ?? "Invalid account details");
  try {
    const { email } = await createPlayerAccount(parsed.data);
    const supabase = await createUserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password: parsed.data.password });
    if (error) throw new Error("Account created. Please log in.");
    return NextResponse.redirect(new URL("/dashboard", request.url), 303);
  } catch (error) {
    return redirectError(request, error instanceof Error ? error.message : "Could not join the league.");
  }
}

function redirectError(request: NextRequest, message: string) {
  const url = new URL("/join", request.url);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url, 303);
}
