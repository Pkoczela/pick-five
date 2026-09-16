import Link from "next/link";
import { requireLeagueContext } from "@/lib/auth/context";
import type { LivePickResult } from "@/lib/domain/live-pool";
import { createUserClient } from "@/lib/supabase/server";

type HistoricalPick = {
  id: string;
  result: LivePickResult;
  selected_side: "HOME" | "AWAY";
  selected_team: { abbreviation: string } | null;
  submitted_line: { home_spread: number } | null;
  game: { kickoff_at: string } | null;
};

type HistoricalEntry = {
  id: string;
  week_id: string;
  picks: HistoricalPick[];
};

type HistoricalResult = {
  entry_id: string;
  week_id: string;
  correct_count: number;
  push_count: number;
  incorrect_count: number;
  void_count: number;
  tiebreaker_prediction: number;
  tiebreaker_actual: number | null;
  tiebreaker_error: number | null;
  is_five_and_zero: boolean;
  is_winner: boolean;
  winnings_cents: number;
  league_member: { display_name: string } | null;
};

export default async function HistoryPage() {
  const context = await requireLeagueContext();
  const supabase = await createUserClient();
  const { data: seasons } = await supabase
    .from("seasons")
    .select("id, year")
    .eq("league_id", context.leagueId)
    .order("year", { ascending: false });
  const seasonIds = (seasons ?? []).map((season) => season.id);
  const { data: weeks } = seasonIds.length
    ? await supabase
        .from("weeks")
        .select("id, season_id, nfl_week, payout_cents, rollover_out_cents, finalized_at")
        .in("season_id", seasonIds)
        .eq("status", "FINAL")
        .order("finalized_at", { ascending: false })
    : { data: null };
  const weekIds = (weeks ?? []).map((week) => week.id);
  const [{ data: rawResults }, { data: rawEntries }] = weekIds.length
    ? await Promise.all([
        supabase
          .from("weekly_player_results")
          .select("entry_id, week_id, correct_count, push_count, incorrect_count, void_count, tiebreaker_prediction, tiebreaker_actual, tiebreaker_error, is_five_and_zero, is_winner, winnings_cents, league_member:league_members(display_name)")
          .in("week_id", weekIds),
        supabase
          .from("entries")
          .select("id, week_id, picks(id, result, selected_side, selected_team:teams!picks_selected_team_id_fkey(abbreviation), submitted_line:official_lines!picks_submitted_official_line_id_fkey(home_spread), game:games(kickoff_at))")
          .in("week_id", weekIds)
          .in("status", ["SUBMITTED", "LOCKED"]),
      ])
    : [{ data: null }, { data: null }];

  const results = (rawResults ?? []) as unknown as HistoricalResult[];
  const entries = (rawEntries ?? []) as unknown as HistoricalEntry[];
  const entryById = new Map(entries.map((entry) => [entry.id, entry]));
  const seasonYearById = new Map((seasons ?? []).map((season) => [season.id, season.year]));

  return (
    <main className="standalone-page history-page">
      <Link href="/dashboard" className="back-link">← This week</Link>
      <p className="eyebrow">ARCHIVE · {context.leagueName.toUpperCase()}</p>
      <h1>Weekly history.</h1>
      <p className="page-lede">Open any finalized week to revisit every entry, pick result, and tiebreaker.</p>
      {weeks?.length ? (
        <div className="history-grid">
          {weeks.map((week) => {
            const weekResults = results
              .filter((result) => result.week_id === week.id)
              .sort((a, b) => Number(b.is_winner) - Number(a.is_winner)
                || b.correct_count - a.correct_count
                || (a.tiebreaker_error ?? Number.MAX_SAFE_INTEGER) - (b.tiebreaker_error ?? Number.MAX_SAFE_INTEGER)
                || (a.league_member?.display_name ?? "").localeCompare(b.league_member?.display_name ?? ""));
            const winners = weekResults.filter((result) => result.is_winner);
            const winnerNames = winners.map((winner) => winner.league_member?.display_name ?? "Player");
            const topScore = weekResults.length ? Math.max(...weekResults.map((result) => result.correct_count)) : null;
            const seasonYear = seasonYearById.get(week.season_id);

            return (
              <details className="history-card" key={week.id}>
                <summary>
                  <span className="history-card-kicker">{seasonYear} · WEEK {week.nfl_week}</span>
                  <span className="history-card-title">{winnerNames.length ? winnerNames.join(" + ") : "No winner"}</span>
                  <span className="history-card-stats">
                    <span>Payout <strong>{formatMoney(week.payout_cents)}</strong></span>
                    <span>Top score <strong>{topScore === null ? "—" : `${topScore} / 5`}</strong></span>
                    <span>Rollover <strong>{formatMoney(week.rollover_out_cents)}</strong></span>
                  </span>
                  <span className="history-card-action" aria-hidden="true"><span>View week</span><i>+</i></span>
                </summary>
                <section className="history-week-details" aria-label={`Week ${week.nfl_week} results`}>
                  <div className="history-detail-heading">
                    <div>
                      <p className="eyebrow">FINAL RESULTS</p>
                      <h2>{weekResults.length} {weekResults.length === 1 ? "entry" : "entries"}</h2>
                    </div>
                    <p>Finalized {formatDate(week.finalized_at)}</p>
                  </div>
                  {weekResults.length ? (
                    <>
                      <p className="pool-key">✓ correct &nbsp; ✕ incorrect &nbsp; — push &nbsp; VOID void</p>
                      <div className="pool-grid history-results-grid">
                        {weekResults.map((result) => {
                          const entry = entryById.get(result.entry_id);
                          return (
                            <article className={`player-card${result.is_winner ? " history-winner" : ""}`} key={result.entry_id}>
                              <div className="player-card-head">
                                <div>
                                  <h2>{result.league_member?.display_name ?? "Player"}</h2>
                                  <span>{result.correct_count} correct · {result.incorrect_count} incorrect{result.push_count ? ` · ${result.push_count} push` : ""}{result.void_count ? ` · ${result.void_count} void` : ""}</span>
                                </div>
                                <span className={result.is_winner ? "winner" : result.is_five_and_zero ? "five-and-zero" : "eliminated"}>{result.is_winner ? "Winner" : result.is_five_and_zero ? "5–0" : "Final"}</span>
                              </div>
                              <ul>
                                {[...(entry?.picks ?? [])]
                                  .sort((a, b) => new Date(a.game?.kickoff_at ?? 0).getTime() - new Date(b.game?.kickoff_at ?? 0).getTime())
                                  .map((pick) => {
                                    const spread = pick.selected_side === "HOME" ? Number(pick.submitted_line?.home_spread ?? 0) : -Number(pick.submitted_line?.home_spread ?? 0);
                                    return <li key={pick.id} className={resultRowClass(pick.result)}><strong>{pick.selected_team?.abbreviation ?? "Team"} {formatSpread(spread)}</strong><span aria-label={pick.result.toLowerCase()}>{symbol(pick.result)}</span></li>;
                                  })}
                              </ul>
                              <footer className="history-entry-footer">
                                <span>Prediction <strong>{result.tiebreaker_prediction}</strong></span>
                                <span>Actual <strong>{result.tiebreaker_actual ?? "—"}</strong></span>
                                <span>Error <strong>{result.tiebreaker_error ?? "—"}</strong></span>
                                {result.winnings_cents > 0 ? <span>Won <strong>{formatMoney(result.winnings_cents)}</strong></span> : null}
                              </footer>
                            </article>
                          );
                        })}
                      </div>
                    </>
                  ) : <div className="coming-panel">No finalized entries are available for this week.</div>}
                </section>
              </details>
            );
          })}
        </div>
      ) : <div className="coming-panel">No finalized weeks yet.</div>}
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

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" }).format(new Date(value));
}
