import { Badge, FlashMessages, PageHeading } from "@/components/ui";
import { initials } from "@/components/views/admin/payments-view";
import { humanize } from "@/lib/format";

export type PlayersData = {
  leagueId: string;
  isOwner: boolean;
  currentMemberId: string;
  inviteHint: string | null;
  rotatedCode?: string;
  members: Array<{ id: string; name: string; role: "OWNER" | "COMMISSIONER" | "PLAYER"; active: boolean }>;
  error?: string;
  notice?: string;
};

export function PlayersView({ leagueId, isOwner, currentMemberId, inviteHint, rotatedCode, members, error, notice }: PlayersData) {
  return (
    <>
      <PageHeading eyebrow="Commissioner · Players & invite" title="Your league." description={`${members.filter((member) => member.active).length} active ${members.length === 1 ? "member" : "members"}.`} />
      <FlashMessages error={error} notice={notice} />
      {rotatedCode ? (
        <section className="invite-banner">
          <div><span>New reusable code</span><strong>{rotatedCode}</strong></div>
          <p>Copy this now. Only its last four characters are kept for reference.</p>
        </section>
      ) : null}
      <section className="invite-control">
        <div><span>Invite code</span><strong>{inviteHint ? `••••-${inviteHint}` : "Disabled"}</strong></div>
        {isOwner ? (
          <div className="button-row">
            <form action="/api/admin/invite/rotate" method="post"><input type="hidden" name="leagueId" value={leagueId} /><button className="button button-primary" type="submit">{inviteHint ? "Rotate code" : "Create code"}</button></form>
            {inviteHint ? <form action="/api/admin/invite/disable" method="post"><input type="hidden" name="leagueId" value={leagueId} /><button className="button button-on-dark" type="submit">Disable</button></form> : null}
          </div>
        ) : <p>Only the league owner can rotate or disable the code.</p>}
      </section>
      <ul className="management-list">
        {members.map((member) => (
          <li className="management-row" key={member.id}>
            <div className="person"><span className="avatar" aria-hidden="true">{initials(member.name)}</span><div><strong>{member.name}</strong><small>{humanize(member.role)}{member.id === currentMemberId ? " · You" : ""}</small></div></div>
            <Badge tone={member.active ? "success" : "neutral"}>{member.active ? "Active" : "Inactive"}</Badge>
            {isOwner ? (
              <details className="disclosure">
                <summary>Manage<span className="sr-only"> {member.name}</span></summary>
                <div className="disclosure-body">
                  <form action="/api/admin/member/display-name" method="post" className="inline-form">
                    <input type="hidden" name="memberId" value={member.id} />
                    <label className="field"><span>Display name</span><input name="displayName" defaultValue={member.name} required minLength={2} maxLength={40} /></label>
                    <button className="button button-quiet" type="submit">Rename</button>
                  </form>
                  <form action="/api/admin/member/update" method="post" className="inline-form">
                    <input type="hidden" name="memberId" value={member.id} />
                    <label className="field"><span>Role</span><select name="role" defaultValue={member.role}><option value="PLAYER">Player</option><option value="COMMISSIONER">Commissioner</option><option value="OWNER">Owner</option></select></label>
                    <label className="field"><span>Status</span><select name="active" defaultValue={String(member.active)}><option value="true">Active</option><option value="false">Inactive</option></select></label>
                    <button className="button button-quiet" type="submit">Save</button>
                  </form>
                  {member.id !== currentMemberId ? (
                    <details className="danger-zone">
                      <summary>Remove from league</summary>
                      <p>Remove <strong>{member.name}</strong> from this league? Their login account stays.</p>
                      <form action="/api/admin/member/remove" method="post"><input type="hidden" name="memberId" value={member.id} /><button className="button button-danger" type="submit">Confirm removal</button></form>
                    </details>
                  ) : null}
                </div>
              </details>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}
