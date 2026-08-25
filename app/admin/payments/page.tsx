import Link from "next/link";
import { requireAdminContext } from "@/lib/auth/context";
import { createUserClient } from "@/lib/supabase/server";

type Payment = { league_member_id: string; status: string; received_cents: number; note: string | null };
export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const context = await requireAdminContext(); const params = await searchParams; const supabase = await createUserClient();
  const { data: seasons } = await supabase.from("seasons").select("id").eq("league_id", context.leagueId).eq("status", "ACTIVE").limit(1);
  const { data: weeks } = seasons?.[0] ? await supabase.from("weeks").select("id, nfl_week, default_entry_fee_cents").eq("season_id", seasons[0].id).neq("status", "DRAFT").order("nfl_week", { ascending: false }).limit(1) : { data: null };
  const week = weeks?.[0];
  const { data: members } = await supabase.from("league_members").select("id, display_name, active").eq("league_id", context.leagueId).eq("active", true).order("display_name");
  const { data: paymentRows } = week ? await supabase.from("payments").select("league_member_id, status, received_cents, note").eq("week_id", week.id) : { data: null };
  const payments = new Map((paymentRows as Payment[] | null ?? []).map((payment) => [payment.league_member_id, payment]));
  return <main className="standalone-page"><Link href="/admin" className="back-link">← Commissioner</Link><p className="eyebrow">PAYMENTS</p><h1>{week ? `Week ${week.nfl_week} fees.` : "Track entry fees."}</h1><p className="page-lede">Payment status never changes a submitted pick. Eligibility follows the policy frozen at publish.</p>
    {params.error ? <p className="form-message form-error">{params.error}</p> : null}{params.notice ? <p className="form-message form-notice">{params.notice}</p> : null}
    {!week ? <div className="coming-panel">Publish a week to initialize payment tracking.</div> : <div className="data-table"> <div className="data-row payment-row data-head"><span>Player</span><span>Status</span><span>Update</span></div>{members?.map((member) => { const payment = payments.get(member.id); const paid = payment?.status === "PAID"; return <div className="data-row payment-row" key={member.id}><strong>{member.display_name}</strong><span className={paid ? "paid-state" : "unpaid-state"}>{paid ? "Paid" : "Unpaid"}</span><form action="/api/admin/payment" method="post"><input type="hidden" name="weekId" value={week.id}/><input type="hidden" name="memberId" value={member.id}/><input type="hidden" name="paid" value={paid ? "false" : "true"}/><button className="button button-quiet" type="submit">Mark {paid ? "unpaid" : "paid"}</button></form></div>; })}</div>}
  </main>;
}
