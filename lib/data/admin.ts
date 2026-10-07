import "server-only";
import { cookies } from "next/headers";
import type { AdminOverviewData } from "@/components/views/admin/overview-view";
import type { AuditData } from "@/components/views/admin/audit-view";
import type { PaymentsData } from "@/components/views/admin/payments-view";
import type { PlayersData } from "@/components/views/admin/players-view";
import type { ResultsData } from "@/components/views/admin/results-view";
import type { SubmissionsData } from "@/components/views/admin/submissions-view";
import type { WeeksData } from "@/components/views/admin/weeks-view";
import type { LeagueContext } from "@/lib/auth/context";
import { INVITE_CODE_COOKIE } from "@/lib/auth/invite-code-cookie";
import { humanize } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createUserClient } from "@/lib/supabase/server";

type Flash = { error?: string; notice?: string };

async function latestPublishedWeek(supabase: Awaited<ReturnType<typeof createUserClient>>, leagueId: string) {
  const { data: seasons } = await supabase.from("seasons").select("id").eq("league_id", leagueId).eq("status", "ACTIVE").limit(1);
  if (!seasons?.[0]) return null;
  const { data: weeks } = await supabase.from("weeks").select("id, nfl_week, status, lock_at, default_entry_fee_cents").eq("season_id", seasons[0].id).neq("status", "DRAFT").order("nfl_week", { ascending: false }).limit(1);
  return weeks?.[0] ?? null;
}

export async function loadAdminOverview(context: LeagueContext): Promise<AdminOverviewData> {
  const supabase = await createUserClient();
  const { data: seasons } = await supabase.from("seasons").select("id").eq("league_id", context.leagueId).order("year", { ascending: false }).limit(1);
  const { data: weeks } = seasons?.[0] ? await supabase.from("weeks").select("id, nfl_week, status, lock_at").eq("season_id", seasons[0].id).order("nfl_week", { ascending: false }).limit(1) : { data: null };
  const week = weeks?.[0];
  if (!week) return { leagueName: context.leagueName, week: null };
  const [{ data: submitted }, { count: members }, { count: paid }] = await Promise.all([
    supabase.rpc("week_submission_count", { p_week_id: week.id }),
    supabase.from("league_members").select("id", { count: "exact", head: true }).eq("league_id", context.leagueId).eq("active", true),
    supabase.from("payments").select("league_member_id", { count: "exact", head: true }).eq("week_id", week.id).eq("status", "PAID"),
  ]);
  const status = week.status === "OPEN" && week.lock_at && Date.now() >= new Date(week.lock_at).getTime() ? "LOCKED" : week.status;
  return { leagueName: context.leagueName, week: { number: week.nfl_week, status, statusLabel: humanize(status), submitted: Number(submitted ?? 0), members: members ?? 0, paid: paid ?? 0 } };
}

type GameRow = { id: string; kickoff_at: string; home_team: { abbreviation: string } | null; away_team: { abbreviation: string } | null; official_lines: Array<{ home_spread: number; is_current: boolean }> };

export async function loadWeeks(context: LeagueContext, flash: Flash): Promise<WeeksData> {
  const supabase = await createUserClient();
  const { data: seasons } = await supabase.from("seasons").select("id, year").eq("league_id", context.leagueId).order("year", { ascending: false }).limit(1);
  const season = seasons?.[0];
  const { data: weeks } = season ? await supabase.from("weeks").select("id, nfl_week, season_type, status, lock_at, test_lock_active").eq("season_id", season.id).order("nfl_week", { ascending: false }).limit(1) : { data: null };
  const week = weeks?.[0];
  const { data: rawGames } = week ? await supabase.from("games").select("id, kickoff_at, home_team:teams!games_home_team_id_fkey(abbreviation), away_team:teams!games_away_team_id_fkey(abbreviation), official_lines(home_spread, is_current)").eq("week_id", week.id).order("kickoff_at") : { data: null };
  return {
    ...flash,
    leagueName: context.leagueName,
    seasonYear: season?.year ?? null,
    week: week ? { id: week.id, number: week.nfl_week, seasonType: week.season_type, status: week.status, lockAt: week.lock_at, testLockActive: week.test_lock_active } : null,
    games: ((rawGames ?? []) as unknown as GameRow[]).map((game) => {
      const line = game.official_lines.find((candidate) => candidate.is_current);
      return { id: game.id, kickoffAt: game.kickoff_at, away: game.away_team?.abbreviation ?? "—", home: game.home_team?.abbreviation ?? "—", homeSpread: line ? Number(line.home_spread) : null };
    }),
  };
}

export async function loadPayments(context: LeagueContext, flash: Flash): Promise<PaymentsData> {
  const supabase = await createUserClient();
  const week = await latestPublishedWeek(supabase, context.leagueId);
  const { data: members } = await supabase.from("league_members").select("id, display_name").eq("league_id", context.leagueId).eq("active", true).order("display_name");
  const { data: payments } = week ? await supabase.from("payments").select("league_member_id, status").eq("week_id", week.id) : { data: null };
  const paid = new Set((payments ?? []).filter((payment) => payment.status === "PAID").map((payment) => payment.league_member_id));
  return {
    ...flash,
    week: week ? { id: week.id, number: week.nfl_week, feeCents: week.default_entry_fee_cents } : null,
    members: (members ?? []).map((member) => ({ id: member.id, name: member.display_name, paid: paid.has(member.id) })),
  };
}

export async function loadSubmissions(context: LeagueContext): Promise<SubmissionsData> {
  const supabase = await createUserClient();
  const week = await latestPublishedWeek(supabase, context.leagueId);
  const { data: members } = await supabase.from("league_members").select("id, display_name").eq("league_id", context.leagueId).eq("active", true).order("display_name");
  // Entry metadata only (never picks): players' RLS hides other entries before lock.
  const { data: entries } = week ? await createAdminClient().from("entries").select("league_member_id, submitted_at").eq("week_id", week.id) : { data: null };
  const { data: payments } = week ? await supabase.from("payments").select("league_member_id, status").eq("week_id", week.id) : { data: null };
  const entryByMember = new Map((entries ?? []).map((entry) => [entry.league_member_id, entry]));
  const paid = new Set((payments ?? []).filter((payment) => payment.status === "PAID").map((payment) => payment.league_member_id));
  return {
    week: week ? { id: week.id, number: week.nfl_week } : null,
    members: (members ?? []).map((member) => {
      const entry = entryByMember.get(member.id);
      return { id: member.id, name: member.display_name, submitted: Boolean(entry), submittedAt: entry?.submitted_at ?? null, paid: paid.has(member.id) };
    }),
  };
}

export async function loadPlayers(context: LeagueContext, flash: Flash): Promise<PlayersData> {
  const supabase = await createUserClient();
  const [{ data: members }, { data: invite }] = await Promise.all([
    supabase.from("league_members").select("id, display_name, role, active").eq("league_id", context.leagueId).order("display_name"),
    supabase.from("league_invites").select("code_hint").eq("league_id", context.leagueId).eq("active", true).maybeSingle(),
  ]);
  return {
    ...flash,
    leagueId: context.leagueId,
    isOwner: context.role === "OWNER",
    currentMemberId: context.memberId,
    inviteHint: invite?.code_hint ?? null,
    rotatedCode: (await cookies()).get(INVITE_CODE_COOKIE)?.value,
    members: (members ?? []).map((member) => ({ id: member.id, name: member.display_name, role: member.role, active: member.active })),
  };
}

type ResultGame = { id: string; status: string; home_score: number | null; away_score: number | null; home_team: { abbreviation: string } | null; away_team: { abbreviation: string } | null; game_results: { ats_result: string } | null };

export async function loadResults(context: LeagueContext, flash: Flash): Promise<ResultsData> {
  const supabase = await createUserClient();
  const { data: seasons } = await supabase.from("seasons").select("id, year").eq("league_id", context.leagueId).eq("status", "ACTIVE").limit(1);
  const season = seasons?.[0];
  const { data: weekRows } = season ? await supabase.from("weeks").select("id, nfl_week, season_type, status, payout_cents, rollover_out_cents, rollover_in_cents, default_entry_fee_cents, contribution_override_cents, test_lock_active").eq("season_id", season.id).neq("status", "DRAFT").order("nfl_week") : { data: null };
  // A correction cascade must be re-finalized oldest first.
  const reopened = (weekRows ?? []).filter((week) => week.status === "REOPENED").sort((a, b) => a.nfl_week - b.nfl_week);
  const week = reopened[0] ?? weekRows?.at(-1);
  if (!week) return { ...flash, seasonYear: season?.year ?? null, week: null, laterReopenedWeeks: 0, games: [], tied: [], simulationEntries: [] };

  const [{ data: rawGames }, { count: entryCount }, { data: rawTied }, { data: rawSimulation }] = await Promise.all([
    supabase.from("games").select("id, status, home_score, away_score, home_team:teams!games_home_team_id_fkey(abbreviation), away_team:teams!games_away_team_id_fkey(abbreviation), game_results(ats_result)").eq("week_id", week.id).order("kickoff_at"),
    supabase.from("entries").select("id", { count: "exact", head: true }).eq("week_id", week.id).in("status", ["SUBMITTED", "LOCKED"]),
    week.status === "TIE_REQUIRES_COMMISSIONER" ? supabase.from("weekly_player_results").select("league_member_id, tiebreaker_error, league_member:league_members(display_name)").eq("week_id", week.id).eq("is_five_and_zero", true) : Promise.resolve({ data: null }),
    week.test_lock_active ? supabase.from("entries").select("id, league_member:league_members(display_name), picks(id)").eq("week_id", week.id).in("status", ["SUBMITTED", "LOCKED"]) : Promise.resolve({ data: null }),
  ]);
  const calculated = (entryCount ?? 0) * week.default_entry_fee_cents;
  return {
    ...flash,
    seasonYear: season?.year ?? null,
    week: {
      id: week.id, number: week.nfl_week, seasonType: week.season_type, status: week.status, testLockActive: week.test_lock_active,
      payoutCents: week.payout_cents ?? 0, rolloverOutCents: week.rollover_out_cents ?? 0,
      jackpotCents: (week.rollover_in_cents ?? 0) + (week.contribution_override_cents ?? calculated),
    },
    laterReopenedWeeks: Math.max(0, reopened.length - 1),
    games: ((rawGames ?? []) as unknown as ResultGame[]).map((game) => ({ id: game.id, away: game.away_team?.abbreviation ?? "—", home: game.home_team?.abbreviation ?? "—", awayScore: game.away_score, homeScore: game.home_score, status: game.status, ats: game.game_results?.ats_result ?? null })),
    tied: ((rawTied ?? []) as unknown as Array<{ league_member_id: string; tiebreaker_error: number | null; league_member: { display_name: string } | null }>).map((row) => ({ memberId: row.league_member_id, name: row.league_member?.display_name ?? "Player", tiebreakerError: row.tiebreaker_error })),
    simulationEntries: ((rawSimulation ?? []) as unknown as Array<{ id: string; league_member: { display_name: string } | null; picks: Array<{ id: string }> }>).filter((entry) => entry.picks.length === 5).map((entry) => ({ id: entry.id, name: entry.league_member?.display_name ?? "Player" })),
  };
}

export async function loadAudit(context: LeagueContext): Promise<AuditData> {
  const supabase = await createUserClient();
  const { data: events } = await supabase.from("audit_events").select("id, event_type, entity_type, reason, created_at").eq("league_id", context.leagueId).order("created_at", { ascending: false }).limit(100);
  return { events: (events ?? []).map((event) => ({ id: event.id, type: event.event_type, entity: event.entity_type, reason: event.reason, createdAt: event.created_at })) };
}
