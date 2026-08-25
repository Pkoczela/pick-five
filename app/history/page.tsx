import Link from "next/link";
import { requireLeagueContext } from "@/lib/auth/context";
import { createUserClient } from "@/lib/supabase/server";

export default async function HistoryPage() {
  const context = await requireLeagueContext(); const supabase = await createUserClient();
  const { data: seasons } = await supabase.from("seasons").select("id").eq("league_id", context.leagueId).order("year", { ascending: false });
  const seasonIds = (seasons ?? []).map((season) => season.id);
  const { data: weeks } = seasonIds.length ? await supabase.from("weeks").select("id, nfl_week, payout_cents, rollover_out_cents, finalized_at").in("season_id", seasonIds).eq("status", "FINAL").order("finalized_at", { ascending: false }) : { data: null };
  const weekIds = (weeks ?? []).map((week) => week.id); const { data: winners } = weekIds.length ? await supabase.from("weekly_player_results").select("week_id, league_member_id, correct_count, league_member:league_members(display_name)").in("week_id", weekIds).eq("is_winner", true) : { data: null };
  return <main className="standalone-page"><Link href="/dashboard" className="back-link">← This week</Link><p className="eyebrow">ARCHIVE · {context.leagueName.toUpperCase()}</p><h1>Weekly history.</h1>{weeks?.length ? <div className="history-grid">{weeks.map((week) => { const weekWinners = (winners ?? []).filter((winner) => winner.week_id === week.id); return <article className="history-card" key={week.id}><span>WEEK {week.nfl_week}</span><h2>{weekWinners.length ? weekWinners.map((winner) => (winner.league_member as unknown as { display_name: string } | null)?.display_name).join(" + ") : "No winner"}</h2><div><span>Payout <strong>{formatMoney(week.payout_cents)}</strong></span><span>Rollover <strong>{formatMoney(week.rollover_out_cents)}</strong></span></div></article>; })}</div> : <div className="coming-panel">No finalized weeks yet.</div>}</main>;
}
function formatMoney(cents: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents/100); }
