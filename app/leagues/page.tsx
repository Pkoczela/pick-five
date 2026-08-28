import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVE_LEAGUE_COOKIE } from "@/lib/auth/active-league";
import { selectActiveMembership } from "@/lib/auth/membership-selection";
import { createUserClient } from "@/lib/supabase/server";

type Membership = {
  id: string;
  display_name: string;
  role: "OWNER" | "COMMISSIONER" | "PLAYER";
  league: { id: string; name: string } | null;
};

export default async function LeaguesPage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const params = await searchParams;
  const supabase = await createUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.from("league_members").select("id,display_name,role,created_at,league:leagues(id,name)").eq("user_id", user.id).eq("active", true).order("created_at");
  const memberships = (data ?? []) as unknown as Membership[];
  const requestedLeagueId = (await cookies()).get(ACTIVE_LEAGUE_COOKIE)?.value;
  const activeLeagueId = selectActiveMembership(memberships, requestedLeagueId)?.league?.id;
  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();

  return (
    <main className="standalone-page league-hub">
      {memberships.length ? <Link href="/dashboard" className="back-link">← Current pool</Link> : <Link href="/" className="back-link">← Pick Five</Link>}
      <p className="eyebrow">YOUR POOLS</p>
      <h1>Choose your league.</h1>
      <p className="page-lede">One account can play in or run as many Pick Five leagues as you need.</p>
      {params.error ? <p className="form-message form-error">{params.error}</p> : null}
      {params.notice ? <p className="form-message form-notice">{params.notice}</p> : null}

      <section className="league-list" aria-label="League memberships">
        {memberships.map((membership) => membership.league ? (
          <article className={membership.league.id === activeLeagueId ? "league-card league-card-active" : "league-card"} key={membership.id}>
            <div><span>{membership.role}</span><h2>{membership.league.name}</h2><p>Playing as {membership.display_name}</p></div>
            {membership.league.id === activeLeagueId ? <strong>Current pool</strong> : <form action="/api/leagues/switch" method="post"><input type="hidden" name="leagueId" value={membership.league.id}/><button className="button button-primary" type="submit">Open pool</button></form>}
          </article>
        ) : null)}
      </section>

      <section className="league-actions">
        <form action="/api/leagues/join" method="post" className="panel league-action-form">
          <div><p className="eyebrow">JOIN ANOTHER</p><h2>Use an invite code.</h2><p>Your existing username and password stay the same.</p></div>
          <label className="field"><span>League code</span><input name="inviteCode" autoCapitalize="characters" autoComplete="off" required minLength={6} placeholder="ABCD-EFGH"/></label>
          <label className="field"><span>Display name in this pool</span><input name="displayName" defaultValue={profile?.display_name ?? ""} required minLength={2} maxLength={40}/></label>
          <button className="button button-primary" type="submit">Join league</button>
        </form>
        <form action="/api/leagues/create" method="post" className="panel league-action-form">
          <div><p className="eyebrow">START ANOTHER</p><h2>Create a league.</h2><p>You’ll be its owner and receive a new reusable invite code.</p></div>
          <label className="field"><span>League name</span><input name="leagueName" required minLength={2} maxLength={60} placeholder="Sunday Pick Five"/></label>
          <label className="field"><span>Your display name</span><input name="displayName" defaultValue={profile?.display_name ?? ""} required minLength={2} maxLength={40}/></label>
          <button className="button button-primary" type="submit">Create league</button>
        </form>
      </section>
    </main>
  );
}
