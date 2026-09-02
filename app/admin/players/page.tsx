import Link from "next/link";
import { cookies } from "next/headers";
import { requireAdminContext } from "@/lib/auth/context";
import { INVITE_CODE_COOKIE } from "@/lib/auth/invite-code-cookie";
import { createUserClient } from "@/lib/supabase/server";

export default async function PlayersPage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const context = await requireAdminContext();
  const params = await searchParams;
  const rotatedCode = (await cookies()).get(INVITE_CODE_COOKIE)?.value;
  const supabase = await createUserClient();
  const { data: members } = await supabase.from("league_members").select("id, display_name, role, active, joined_at").eq("league_id", context.leagueId).order("display_name");
  const { data: invite } = await supabase.from("league_invites").select("code_hint, created_at").eq("league_id", context.leagueId).eq("active", true).maybeSingle();
  return <main className="standalone-page"><Link href="/admin" className="back-link">← Commissioner</Link><p className="eyebrow">PLAYERS & INVITE</p><h1>Your league.</h1>
    {params.error ? <p className="form-message form-error">{params.error}</p> : null}
    {rotatedCode ? <section className="invite-banner"><div><span>NEW REUSABLE CODE</span><strong>{rotatedCode}</strong></div><p>Copy this now. Only its final four characters are retained for reference.</p></section> : null}
    <section className="invite-control"><div><span>Active code</span><strong>{invite ? `••••-${invite.code_hint}` : "Disabled"}</strong></div>{context.role === "OWNER" ? <div className="invite-actions"><form action="/api/admin/invite/rotate" method="post"><input type="hidden" name="leagueId" value={context.leagueId}/><button className="button button-primary" type="submit">{invite?"Rotate code":"Create code"}</button></form>{invite?<form action="/api/admin/invite/disable" method="post"><input type="hidden" name="leagueId" value={context.leagueId}/><button className="button button-danger" type="submit">Disable</button></form>:null}</div> : null}</section>
    <div className="data-table"><div className="data-row member-row data-head"><span>Player</span><span>Role</span><span>Status</span><span>Owner controls</span></div>{members?.map((member) => <div className="data-row member-row" key={member.id}><strong>{member.display_name}</strong><span>{member.role}</span><span>{member.active ? "Active" : "Inactive"}</span>{context.role==="OWNER"?<div className="member-controls"><form action="/api/admin/member/update" method="post"><input type="hidden" name="memberId" value={member.id}/><select name="role" defaultValue={member.role}><option>PLAYER</option><option>COMMISSIONER</option><option>OWNER</option></select><select name="active" defaultValue={String(member.active)}><option value="true">Active</option><option value="false">Inactive</option></select><button type="submit">Save</button></form>{member.id!==context.memberId?<details className="remove-member"><summary>Remove</summary><div><p>Remove <strong>{member.display_name}</strong> from this league? Their login account will remain.</p><form action="/api/admin/member/remove" method="post"><input type="hidden" name="memberId" value={member.id}/><button type="submit">Confirm removal</button></form></div></details>:<span className="owner-self">Current owner</span>}</div>:<span>—</span>}</div>)}</div>
  </main>;
}
