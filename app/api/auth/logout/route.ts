import { NextRequest, NextResponse } from "next/server";
import { createUserClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createUserClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", request.url), 303);
}
