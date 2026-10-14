import { Badge, FlashMessages, PageHeading } from "@/components/ui";
import { humanize } from "@/lib/format";

export type LeaguesData = {
  memberships: Array<{ id: string; leagueId: string; leagueName: string; role: string; displayName: string }>;
  activeLeagueId: string | null;
  profileName: string;
  error?: string;
  notice?: string;
};

export function LeaguesView({ memberships, activeLeagueId, profileName, error, notice }: LeaguesData) {
  return (
    <>
      <PageHeading eyebrow="Your leagues" title={memberships.length ? "Your pools." : "Find your people."} description="One account. Your own name in every pool." />
      <FlashMessages error={error} notice={notice} />
      <section className="league-list" aria-label="League memberships">
        {memberships.map((membership) => {
          const active = membership.leagueId === activeLeagueId;
          return (
            <article className={`league-card ${active ? "is-active" : ""}`} key={membership.id}>
              <div className="league-card-copy">
                {active ? <Badge tone="success">Current pool</Badge> : <Badge>{humanize(membership.role)}</Badge>}
                <h2>{membership.leagueName}</h2>
                <p>Playing as {membership.displayName}{active ? ` · ${humanize(membership.role)}` : ""}</p>
              </div>
              {active ? null : <form action="/api/leagues/switch" method="post"><input type="hidden" name="leagueId" value={membership.leagueId} /><button className="button button-primary" type="submit">Open pool</button></form>}
              <details className="disclosure">
                <summary>Change display name</summary>
                <form action="/api/leagues/display-name" method="post" className="inline-form">
                  <input type="hidden" name="memberId" value={membership.id} />
                  <label className="field"><span>Display name in {membership.leagueName}</span><input name="displayName" defaultValue={membership.displayName} required minLength={2} maxLength={40} /></label>
                  <button className="button button-quiet" type="submit">Save name</button>
                </form>
              </details>
            </article>
          );
        })}
      </section>
      <section className="league-actions">
        <form action="/api/leagues/join" method="post" className="panel stack-form">
          <div><p className="eyebrow">Join another</p><h2>Use an invite code.</h2><p>Your username and password stay the same.</p></div>
          <label className="field"><span>League code</span><input name="inviteCode" autoCapitalize="characters" autoComplete="off" required minLength={6} placeholder="ABCD-EFGH" /></label>
          <label className="field"><span>Display name in this pool</span><input name="displayName" defaultValue={profileName} required minLength={2} maxLength={40} /></label>
          <button className="button button-primary" type="submit">Join league</button>
        </form>
        <form action="/api/leagues/create" method="post" className="panel stack-form">
          <div><p className="eyebrow">Start another</p><h2>Create a league.</h2><p>You’ll be its owner and get a reusable invite code.</p></div>
          <label className="field"><span>League name</span><input name="leagueName" required minLength={2} maxLength={60} placeholder="Sunday Pick Five" /></label>
          <label className="field"><span>Your display name</span><input name="displayName" defaultValue={profileName} required minLength={2} maxLength={40} /></label>
          <button className="button button-quiet" type="submit">Create league</button>
        </form>
      </section>
    </>
  );
}
