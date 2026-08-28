import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createUserClient } from "@/lib/supabase/server";
import { ACTIVE_LEAGUE_COOKIE } from "@/lib/auth/active-league";
import { selectActiveMembership } from "@/lib/auth/membership-selection";

export type LeagueContext = {
  userId: string;
  memberId: string;
  displayName: string;
  role: "OWNER" | "COMMISSIONER" | "PLAYER";
  leagueId: string;
  leagueName: string;
  leagueCount: number;
};

type MembershipRow = {
  id: string;
  display_name: string;
  role: LeagueContext["role"];
  league: { id: string; name: string } | null;
};

export async function requireLeagueContext(): Promise<LeagueContext> {
  const supabase = await createUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.from("league_members").select("id, display_name, role, created_at, league:leagues(id, name)").eq("user_id", user.id).eq("active", true).order("created_at");
  const memberships = (data ?? []) as unknown as MembershipRow[];
  const requestedLeagueId = (await cookies()).get(ACTIVE_LEAGUE_COOKIE)?.value;
  const membership = selectActiveMembership(memberships, requestedLeagueId);
  if (!membership?.league) redirect("/leagues?error=No active league membership was found.");
  return {
    userId: user.id,
    memberId: membership.id,
    displayName: membership.display_name,
    role: membership.role,
    leagueId: membership.league.id,
    leagueName: membership.league.name,
    leagueCount: memberships.length,
  };
}

export async function requireAdminContext() {
  const context = await requireLeagueContext();
  if (context.role === "PLAYER") redirect("/dashboard");
  return context;
}
