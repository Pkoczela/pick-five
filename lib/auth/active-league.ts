import type { NextRequest, NextResponse } from "next/server";

export const ACTIVE_LEAGUE_COOKIE = "pick-five-active-league";

export function setActiveLeagueCookie(response: NextResponse, request: NextRequest, leagueId: string) {
  response.cookies.set(ACTIVE_LEAGUE_COOKIE, leagueId, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export function clearActiveLeagueCookie(response: NextResponse) {
  response.cookies.set(ACTIVE_LEAGUE_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}
