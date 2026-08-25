import Link from "next/link";
import { requireLeagueContext } from "@/lib/auth/context";
import { createUserClient } from "@/lib/supabase/server";

type Result = { league_member_id: string; correct_count: number; is_winner: boolean; winnings_cents: number };
export default async function StandingsPage() {
  const context = await requireLeagueContext(); const supabase = await createUserClient();
  const { data: members } = await supabase.from("league_members").select("id, display_name").eq("league_id", context.leagueId).order("display_name");
  const { data: seasons } = await supabase.from("seasons").select("id").eq("league_id", context.leagueId).eq("status", "ACTIVE").limit(1);
  const { data: raw } = seasons?.[0] ? await supabase.from("weekly_player_results").select("league_member_id, correct_count, is_winner, winnings_cents, weeks!inner(season_id)").eq("weeks.season_id", seasons[0].id) : { data: null };
  const results = raw as unknown as Result[] | null; const totals = new Map<string, { correct: number; weeks: number; wins: number; winnings: number }>();
  for (const result of results ?? []) { const total = totals.get(result.league_member_id) ?? { correct: 0, weeks: 0, wins: 0, winnings: 0 }; total.correct += result.correct_count; total.weeks += 1; total.wins += result.is_winner ? 1 : 0; total.winnings += result.winnings_cents; totals.set(result.league_member_id, total); }
  const rows = (members ?? []).map((member) => ({ ...member, ...(totals.get(member.id) ?? { correct: 0, weeks: 0, wins: 0, winnings: 0 }) })).sort((a,b) => b.correct - a.correct || (b.weeks ? b.correct/b.weeks : 0) - (a.weeks ? a.correct/a.weeks : 0) || a.display_name.localeCompare(b.display_name));
  return <main className="standalone-page"><Link href="/dashboard" className="back-link">← This week</Link><p className="eyebrow">SEASON · {context.leagueName.toUpperCase()}</p><h1>Standings.</h1><div className="data-table standings-table"><div className="data-row standings-row data-head"><span>Rank / player</span><span>Correct</span><span>Average</span><span>5–0 wins</span><span>Winnings</span></div>{rows.map((row,index) => <div className="data-row standings-row" key={row.id}><strong>{index+1}. {row.display_name}</strong><span>{row.correct}</span><span>{row.weeks ? (row.correct/row.weeks).toFixed(2) : "—"}</span><span>{row.wins}</span><span>{formatMoney(row.winnings)}</span></div>)}</div></main>;
}
function formatMoney(cents: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents/100); }
