import { NextRequest, NextResponse } from "next/server";

export function redirectWith(request: NextRequest, path: string, kind: "error" | "notice", message: string) {
  const url = new URL(path, request.url);
  url.searchParams.set(kind, message);
  return NextResponse.redirect(url, 303);
}
