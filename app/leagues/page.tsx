import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { LeaguesView, type LeaguesData } from "@/components/views/leagues-view";
import { ACTIVE_LEAGUE_COOKIE } from "@/lib/auth/active-league";
import { selectActiveMembership } from "@/lib/auth/membership-selection";
import { isPreviewMode } from "@/lib/preview-mode";
import { getPreviewState } from "@/lib/preview/server";
import { sampleLeagues } from "@/lib/preview/sample";
import { createUserClient } from "@/lib/supabase/server";

type Membership = { id: string; display_name: string; role: "OWNER" | "COMMISSIONER" | "PLAYER"; league: { id: string; name: string } | null };

export default async function LeaguesPage({ searchParams }: PageProps<"/leagues">) {
  const params = await searchParams;
  const flash = { error: typeof params.error === "string" ? params.error : undefined, notice: typeof params.notice === "string" ? params.notice : undefined };
  const data: LeaguesData = isPreviewMode() ? { ...sampleLeagues(await getPreviewState()), ...flash } : { ...await loadLeagues(), ...flash };
  const active = data.memberships.find((membership) => membership.leagueId === data.activeLeagueId);
  if (!active) {
    return (
      <div className="app-frame">
        <header className="app-header"><Link href="/" className="wordmark"><span className="mark" aria-hidden="true">5</span><span>PICK FIVE</span></Link></header>
        <main className="solo-main" id="main-content"><LeaguesView {...data} /></main>
      </div>
    );
  }
  return (
    <AppShell leagueName={active.leagueName} displayName={active.displayName} isAdmin={active.role !== "PLAYER"} leagueCount={data.memberships.length}>
      <LeaguesView {...data} />
    </AppShell>
  );
}

async function loadLeagues(): Promise<Omit<LeaguesData, "error" | "notice">> {
  const supabase = await createUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.from("league_members").select("id,display_name,role,created_at,league:leagues(id,name)").eq("user_id", user.id).eq("active", true).order("created_at");
  const memberships = (data ?? []) as unknown as Membership[];
  const activeLeagueId = selectActiveMembership(memberships, (await cookies()).get(ACTIVE_LEAGUE_COOKIE)?.value)?.league?.id ?? null;
  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
  return {
    memberships: memberships.flatMap((membership) => membership.league ? [{ id: membership.id, leagueId: membership.league.id, leagueName: membership.league.name, role: membership.role, displayName: membership.display_name }] : []),
    activeLeagueId,
    profileName: profile?.display_name ?? "",
  };
}
