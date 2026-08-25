import "server-only";
import { redirect } from "next/navigation";
import { createUserClient } from "@/lib/supabase/server";

export type LeagueContext = {
  userId: string;
  memberId: string;
  displayName: string;
  role: "OWNER" | "COMMISSIONER" | "PLAYER";
  leagueId: string;
  leagueName: string;
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
  const { data } = await supabase.from("league_members").select("id, display_name, role, league:leagues(id, name)").eq("user_id", user.id).eq("active", true).limit(1).maybeSingle();
  const membership = data as unknown as MembershipRow | null;
  if (!membership?.league) redirect("/join?error=No active league membership was found.");
  return {
    userId: user.id,
    memberId: membership.id,
    displayName: membership.display_name,
    role: membership.role,
    leagueId: membership.league.id,
    leagueName: membership.league.name,
  };
}

export async function requireAdminContext() {
  const context = await requireLeagueContext();
  if (context.role === "PLAYER") redirect("/dashboard");
  return context;
}
