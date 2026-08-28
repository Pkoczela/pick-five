import Link from "next/link";
import { notFound } from "next/navigation";
import { requireLeagueContext } from "@/lib/auth/context";
import { isEffectivelyLocked } from "@/lib/domain/deadline";
import { LivePickResult, summarizeLiveEntry } from "@/lib/domain/live-pool";
import { createUserClient } from "@/lib/supabase/server";

type Pick = {
  id: string;
  result: LivePickResult;
  selected_side: "HOME" | "AWAY";
  selected_team: { abbreviation: string } | null;
  game: { id: string; kickoff_at: string; official_lines: Array<{ home_spread: number; is_current: boolean }> } | null;
};

type Entry = {
  id: string;
  tiebreaker_points: number;
  league_member: { display_name: string } | null;
  picks: Pick[];
};

export default async function LivePage({ params }: { params: Promise<{ weekId: string }> }) {
  const { weekId } = await params;
  const context = await requireLeagueContext();
  const supabase = await createUserClient();
  const { data: week } = await supabase
    .from("weeks")
    .select("id, nfl_week, status, lock_at, test_lock_active, season:seasons!inner(league_id)")
    .eq("id", weekId)
    .maybeSingle();

  const weekLeagueId = (week as unknown as { season: { league_id: string } | null } | null)?.season?.league_id;
  if (!week?.lock_at || weekLeagueId !== context.leagueId) notFound();
  if (!isEffectivelyLocked(week.status, new Date(week.lock_at))) {
    return (
      <main className="standalone-page">
        <Link href="/dashboard" className="back-link">← This week</Link>
        <p className="eyebrow">POOL BOARD</p>
        <h1>Picks stay private until lock.</h1>
        <p className="page-lede">Come back after {formatDate(week.lock_at)} to see every submitted entry.</p>
      </main>
    );
  }

  const { data: raw } = await supabase
    .from("entries")
    .select("id,tiebreaker_points,league_member:league_members(display_name),picks(id,result,selected_side,selected_team:teams!picks_selected_team_id_fkey(abbreviation),game:games(id,kickoff_at,official_lines(home_spread,is_current)))")
    .eq("week_id", weekId)
    .in("status", ["SUBMITTED", "LOCKED"]);

  const entries = ((raw ?? []) as unknown as Entry[])
    .map((entry) => ({ ...entry, summary: summarizeLiveEntry(entry.picks.map((pick) => pick.result)) }))
    .sort((a, b) => Number(b.summary.aliveForFive) - Number(a.summary.aliveForFive)
      || b.summary.correct - a.summary.correct
      || (a.league_member?.display_name ?? "").localeCompare(b.league_member?.display_name ?? ""));
  const aliveCount = entries.filter((entry) => entry.summary.aliveForFive).length;
  const pendingCount = entries.reduce((total, entry) => total + entry.summary.pending, 0);

  return (
    <main className="standalone-page">
      <Link href="/dashboard" className="back-link">← This week</Link>
      <p className="eyebrow">LIVE POOL · WEEK {week.nfl_week}</p>
      <h1>Everyone’s five.</h1>
      <p className="page-lede">Follow every entry as games finish. A loss or push eliminates an entry from the 5–0 jackpot.</p>
      {week.test_lock_active ? <div className="test-lock-banner">Locked-board test is active. These are real submitted picks, temporarily revealed for testing.</div> : null}
      <section className="pool-summary" aria-label="Pool status">
        <div><span>Entries</span><strong>{entries.length}</strong></div>
        <div><span>Still alive</span><strong>{aliveCount}</strong></div>
        <div><span>Pending picks</span><strong>{pendingCount}</strong></div>
      </section>
      <p className="pool-key">✓ correct &nbsp; ✕ incorrect &nbsp; … pending &nbsp; — push</p>
      {entries.length === 0 ? (
        <div className="coming-panel">No submitted entries are available for this week.</div>
      ) : (
        <div className="pool-grid">
          {entries.map((entry) => (
            <article className="player-card" key={entry.id}>
              <div className="player-card-head">
                <div>
                  <h2>{entry.league_member?.display_name ?? "Player"}</h2>
                  <span>{entry.summary.correct} correct · {entry.summary.pending} pending</span>
                </div>
                <span className={entry.summary.aliveForFive ? "alive" : "eliminated"}>{entry.summary.aliveForFive ? "Still alive for 5–0" : "Eliminated"}</span>
              </div>
              <ul>
                {[...entry.picks].sort((a, b) => new Date(a.game?.kickoff_at ?? 0).getTime() - new Date(b.game?.kickoff_at ?? 0).getTime()).map((pick) => {
                  const line = pick.game?.official_lines.find((candidate) => candidate.is_current);
                  const spread = pick.selected_side === "HOME" ? Number(line?.home_spread ?? 0) : -Number(line?.home_spread ?? 0);
                  return <li key={pick.id} className={resultRowClass(pick.result)}><strong>{pick.selected_team?.abbreviation} {formatSpread(spread)}</strong><span aria-label={pick.result.toLowerCase()}>{symbol(pick.result)}</span></li>;
                })}
              </ul>
              <footer>MNF prediction <strong>{entry.tiebreaker_points}</strong></footer>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

function symbol(result: LivePickResult) {
  if (result === "CORRECT") return "✓";
  if (result === "INCORRECT") return "✕";
  if (result === "PUSH") return "—";
  if (result === "VOID") return "VOID";
  return "…";
}

function resultRowClass(result: LivePickResult) {
  if (result === "CORRECT") return "pick-result-correct";
  if (result === "INCORRECT") return "pick-result-incorrect";
  return undefined;
}

function formatSpread(value: number) {
  return value === 0 ? "PK" : `${value > 0 ? "+" : ""}${value}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", hour: "numeric", minute: "2-digit", timeZone: "America/New_York", timeZoneName: "short" }).format(new Date(value));
}
