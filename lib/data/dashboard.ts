import "server-only";
import { cookies } from "next/headers";
import type { DashboardData } from "@/components/views/dashboard-view";
import type { LeagueContext } from "@/lib/auth/context";
import { INVITE_CODE_COOKIE, INVITE_LEAGUE_COOKIE } from "@/lib/auth/invite-code-cookie";
import { calculateWeeklyFinancials } from "@/lib/domain/financials";
import { computeStandings, type WeeklyResult } from "@/lib/domain/standings";
import { formatMoney, humanize } from "@/lib/format";
import { createUserClient } from "@/lib/supabase/server";

export async function loadDashboard(context: LeagueContext): Promise<DashboardData> {
  const cookieStore = await cookies();
  const inviteCode = cookieStore.get(INVITE_LEAGUE_COOKIE)?.value === context.leagueId ? cookieStore.get(INVITE_CODE_COOKIE)?.value : undefined;
  const supabase = await createUserClient();
  const { data: seasons } = await supabase.from("seasons").select("id").eq("league_id", context.leagueId).eq("status", "ACTIVE").limit(1);
  const seasonId = seasons?.[0]?.id;
  const { data: weeks } = seasonId
    ? await supabase.from("weeks").select("id, nfl_week, status, lock_at, rollover_in_cents, default_entry_fee_cents, contribution_override_cents, payout_cents, rollover_out_cents").eq("season_id", seasonId).neq("status", "DRAFT").order("nfl_week", { ascending: false }).limit(5)
    : { data: null };
  const week = weeks?.[0];
  const lastFinal = weeks?.find((candidate) => candidate.status === "FINAL" && candidate.id !== week?.id) ?? (week?.status === "FINAL" ? week : undefined);

  const [{ data: submissionCount }, { count: memberCount }, { data: entry }, { data: rawResults }, { data: members }, { data: rawWinners }] = await Promise.all([
    week ? supabase.rpc("week_submission_count", { p_week_id: week.id }) : Promise.resolve({ data: 0 }),
    supabase.from("league_members").select("id", { count: "exact", head: true }).eq("league_id", context.leagueId).eq("active", true),
    week ? supabase.from("entries").select("status, submitted_at").eq("week_id", week.id).eq("league_member_id", context.memberId).in("status", ["SUBMITTED", "LOCKED"]).maybeSingle() : Promise.resolve({ data: null }),
    seasonId ? supabase.from("weekly_player_results").select("league_member_id, week_id, correct_count, is_winner, winnings_cents, weeks!inner(season_id)").eq("weeks.season_id", seasonId) : Promise.resolve({ data: null }),
    supabase.from("league_members").select("id, display_name").eq("league_id", context.leagueId).eq("active", true),
    lastFinal ? supabase.from("weekly_player_results").select("league_member:league_members(display_name)").eq("week_id", lastFinal.id).eq("is_winner", true) : Promise.resolve({ data: null }),
  ]);

  const participatingEntries = Number(submissionCount ?? 0);
  const results = (rawResults ?? []) as unknown as WeeklyResult[];
  const standings = results.length ? computeStandings(members ?? [], results) : [];
  const own = standings.find((row) => row.id === context.memberId);
  const statusLabel = week ? effectiveStatus(week.status, week.lock_at) : "";

  return {
    leagueName: context.leagueName,
    isAdmin: context.role !== "PLAYER",
    inviteCode,
    week: week ? {
      id: week.id,
      number: week.nfl_week,
      statusLabel: humanize(statusLabel),
      locked: statusLabel !== "OPEN",
      final: week.status === "FINAL",
      lockAt: week.lock_at,
      jackpotCents: calculateWeeklyFinancials({ participatingEntries, defaultEntryFeeCents: week.default_entry_fee_cents, contributionOverrideCents: week.contribution_override_cents, rolloverInCents: week.rollover_in_cents, resolution: "NO_WINNER" }).availableJackpotCents,
      jackpotBasis: week.contribution_override_cents !== null ? "Commissioner contribution override applied" : jackpotBasis(participatingEntries, week.default_entry_fee_cents, week.rollover_in_cents),
      entry: entry ? { locked: entry.status === "LOCKED", submittedAt: entry.submitted_at } : null,
      submittedCount: participatingEntries,
      memberCount: memberCount ?? 0,
    } : null,
    season: own ? { correct: own.correct, rank: own.rank, players: standings.length } : null,
    lastWeek: lastFinal ? {
      id: lastFinal.id,
      number: lastFinal.nfl_week,
      winners: ((rawWinners ?? []) as unknown as Array<{ league_member: { display_name: string } | null }>).flatMap((winner) => winner.league_member ? [winner.league_member.display_name] : []),
      payoutCents: lastFinal.payout_cents ?? 0,
      rolloverCents: lastFinal.rollover_out_cents ?? 0,
    } : null,
  };
}

function effectiveStatus(status: string, lockAt: string | null) {
  return status === "OPEN" && lockAt && Date.now() >= new Date(lockAt).getTime() ? "LOCKED" : status;
}

function jackpotBasis(entries: number, feeCents: number, rolloverCents: number) {
  const contribution = `${entries} ${entries === 1 ? "entry" : "entries"} × ${formatMoney(feeCents)}`;
  return rolloverCents > 0 ? `${contribution} + ${formatMoney(rolloverCents)} rollover` : contribution;
}
