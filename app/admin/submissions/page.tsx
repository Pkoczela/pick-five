import Link from "next/link";
import { requireAdminContext } from "@/lib/auth/context";
import { createUserClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Entry = { league_member_id: string; status: string; submitted_at: string | null };
type Payment = { league_member_id: string; status: string };
export default async function SubmissionsPage() {
  const context = await requireAdminContext(); const supabase = await createUserClient(); const admin = createAdminClient();
  const { data: seasons } = await supabase.from("seasons").select("id").eq("league_id", context.leagueId).eq("status", "ACTIVE").limit(1);
  const { data: weeks } = seasons?.[0] ? await supabase.from("weeks").select("id, nfl_week, lock_at").eq("season_id", seasons[0].id).neq("status", "DRAFT").order("nfl_week", { ascending: false }).limit(1) : { data: null };
  const week = weeks?.[0];
  const { data: members } = await supabase.from("league_members").select("id, display_name").eq("league_id", context.leagueId).eq("active", true).order("display_name");
  const { data: entryRows } = week ? await admin.from("entries").select("league_member_id, status, submitted_at").eq("week_id", week.id) : { data: null };
  const { data: paymentRows } = week ? await supabase.from("payments").select("league_member_id, status").eq("week_id", week.id) : { data: null };
  const entries = new Map((entryRows as Entry[] | null ?? []).map((entry) => [entry.league_member_id, entry])); const payments = new Map((paymentRows as Payment[] | null ?? []).map((payment) => [payment.league_member_id, payment]));
  return <main className="standalone-page"><Link href="/admin" className="back-link">← Commissioner</Link><p className="eyebrow">ENTRY STATUS</p><h1>{week ? `Week ${week.nfl_week}: who’s in?` : "Who’s in?"}</h1><p className="page-lede">Before lock, this shows submission metadata only. Actual picks stay behind the explicit audited exception workflow.</p>
    {!week ? <div className="coming-panel">Publish a week to track submissions.</div> : <div className="data-table"><div className="data-row submission-row data-head"><span>Player</span><span>Entry</span><span>Submitted</span><span>Paid</span><span>Exception</span></div>{members?.map((member) => { const entry = entries.get(member.id); return <div className="data-row submission-row" key={member.id}><strong>{member.display_name}</strong><span>{entry ? "Submitted" : "Missing"}</span><span>{entry?.submitted_at ? formatDate(entry.submitted_at) : "—"}</span><span>{payments.get(member.id)?.status === "PAID" ? "Yes" : "No"}</span><Link href={`/admin/entries/${member.id}?weekId=${week.id}`}>View / edit</Link></div>; })}</div>}
  </main>;
}
function formatDate(value: string) { return new Intl.DateTimeFormat("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }).format(new Date(value)); }
