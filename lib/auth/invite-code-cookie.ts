import type { NextRequest, NextResponse } from "next/server";

export const INVITE_CODE_COOKIE = "pick-five-invite-code";

export function setInviteCodeCookie(response: NextResponse, request: NextRequest, code: string) {
  response.cookies.set(INVITE_CODE_COOKIE, code, {
    httpOnly: true,
    sameSite: "strict",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 5 * 60,
  });
}
