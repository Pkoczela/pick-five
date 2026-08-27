import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { hasSupabaseEnvironment } from "@/lib/env";
import { createUserClient } from "@/lib/supabase/server";
import { INVITE_CODE_COOKIE } from "@/lib/auth/invite-code-cookie";
import { calculateWeeklyFinancials } from "@/lib/domain/financials";

type Membership = {
  id: string;
  display_name: string;
  role: "OWNER" | "COMMISSIONER" | "PLAYER";
  league: { id: string; name: string; slug: string } | null;
};

export default async function DashboardPage() {
  if (!hasSupabaseEnvironment()) return <SetupRequired />;
  const inviteCode = (await cookies()).get(INVITE_CODE_COOKIE)?.value;
  const supabase = await createUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("league_members")
    .select("id, display_name, role, league:leagues(id, name, slug)")
    .eq("user_id", user.id)
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  const membership = data as unknown as Membership | null;
  if (!membership?.league) redirect("/join?error=No active league membership was found.");

  const isAdmin = membership.role === "OWNER" || membership.role === "COMMISSIONER";
  const { data: seasons } = await supabase
    .from("seasons")
    .select("id")
    .eq("league_id", membership.league.id)
    .eq("status", "ACTIVE")
    .limit(1);
  const seasonId = seasons?.[0]?.id;
  const { data: weeks } = seasonId
    ? await supabase.from("weeks").select("id, nfl_week, status, lock_at, rollover_in_cents, default_entry_fee_cents, contribution_override_cents").eq("season_id", seasonId).neq("status", "DRAFT").order("nfl_week", { ascending: false }).limit(1)
    : { data: null };
  const week = weeks?.[0];
  const { data: submissionCount } = week
    ? await supabase.rpc("week_submission_count", { p_week_id: week.id })
    : { data: 0 };
  const participatingEntries = Number(submissionCount ?? 0);
  const financials = week
    ? calculateWeeklyFinancials({
        participatingEntries,
        defaultEntryFeeCents: week.default_entry_fee_cents,
        contributionOverrideCents: week.contribution_override_cents,
        rolloverInCents: week.rollover_in_cents,
        resolution: "NO_WINNER",
      })
    : null;
  const { data: entry } = week
    ? await supabase.from("entries").select("id, status, submitted_at").eq("week_id", week.id).eq("league_member_id", membership.id).maybeSingle()
    : { data: null };
  const weekLabel = week ? effectiveLabel(week.status, week.lock_at) : null;
  const isLocked = weekLabel !== "OPEN";

  return (
    <AppShell leagueName={membership.league.name} displayName={membership.display_name} isAdmin={isAdmin}>
      {inviteCode ? (
        <section className="invite-banner">
          <div><span>YOUR REUSABLE LEAGUE CODE</span><strong>{inviteCode}</strong></div>
          <p>Share this with the people you want to join. You can rotate or disable it later.</p>
        </section>
      ) : null}
      {week ? (
        <>
          <div className="page-heading"><div><p className="eyebrow">CURRENT POOL</p><h1>Week {week.nfl_week}</h1></div><span className="status-pill">{weekLabel}</span></div>
          <section className="dashboard-grid">
            <article className="metric-card jackpot-card"><span>Current jackpot</span><strong>{formatMoney(financials?.availableJackpotCents ?? 0)}</strong><small>{week.contribution_override_cents !== null ? "Commissioner contribution override applied" : formatJackpotBasis(participatingEntries, week.default_entry_fee_cents, week.rollover_in_cents)}</small></article>
            <article className="metric-card"><span>Your entry</span><strong className="entry-state">{entry && ["SUBMITTED", "LOCKED"].includes(entry.status) ? (entry.status === "LOCKED" ? "Locked" : "Submitted") : "Not submitted"}</strong><small>{entry?.submitted_at ? `Saved ${new Date(entry.submitted_at).toLocaleString()}` : "Pick five teams before lock"}</small></article>
          </section>
          <section className="primary-action-card">
            <div><p className="eyebrow">YOUR WEEK</p><h2>{entry ? "Your five are in." : "Ready to make your five?"}</h2><p>{formatLock(week.lock_at)}</p></div>
            <Link href={isLocked ? `/live/${week.id}` : `/picks/${week.id}`} className="button button-primary">{isLocked ? "View live pool" : entry ? "Review picks" : "Make picks"} <span aria-hidden="true">→</span></Link>
          </section>
        </>
      ) : (
        <section className="empty-state">
          <p className="eyebrow">NO OPEN WEEK</p>
          <h1>{isAdmin ? "Set up the first week." : "Your commissioner is getting things ready."}</h1>
          <p>{isAdmin ? "Create a season, import the NFL schedule, enter the official lines, and publish when everything is ready." : "Come back once the schedule and official lines have been published."}</p>
          {isAdmin ? <Link href="/admin" className="button button-primary">Open commissioner tools</Link> : null}
        </section>
      )}
    </AppShell>
  );
}

function SetupRequired() {
  return <main className="setup-state"><p className="eyebrow">LOCAL SETUP</p><h1>Connect Supabase to continue.</h1><p>Copy <code>.env.example</code> to <code>.env.local</code>, add the project credentials, then apply the migrations in <code>supabase/migrations</code>.</p><Link href="/">Return home</Link></main>;
}

function effectiveLabel(status: string, lockAt: string | null) {
  if (status === "OPEN" && lockAt && Date.now() >= new Date(lockAt).getTime()) return "LOCKED";
  return status.replaceAll("_", " ");
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

function formatJackpotBasis(entries: number, feeCents: number, rolloverCents: number) {
  const contribution = `${entries} ${entries === 1 ? "entry" : "entries"} × ${formatMoney(feeCents)}`;
  return rolloverCents > 0 ? `${contribution} + ${formatMoney(rolloverCents)} rollover` : contribution;
}

function formatLock(lockAt: string | null) {
  if (!lockAt) return "The deadline is set when the commissioner publishes.";
  return `Picks lock ${new Intl.DateTimeFormat("en-US", { weekday: "long", hour: "numeric", minute: "2-digit", timeZone: "America/New_York", timeZoneName: "short" }).format(new Date(lockAt))}.`;
}
