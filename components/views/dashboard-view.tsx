import Link from "next/link";
import { Badge, EmptyState, Icon, PageHeading, Stat } from "@/components/ui";
import { formatDateTime, formatMoney } from "@/lib/format";

export type DashboardData = {
  leagueName: string;
  isAdmin: boolean;
  inviteCode?: string;
  week: null | {
    id: string;
    number: number;
    statusLabel: string;
    locked: boolean;
    final: boolean;
    lockAt: string | null;
    jackpotCents: number;
    jackpotBasis: string;
    entry: { locked: boolean; submittedAt: string | null } | null;
    submittedCount: number;
    memberCount: number;
  };
  season: { correct: number; rank: number; players: number } | null;
  lastWeek: { id: string; number: number; winners: string[]; payoutCents: number; rolloverCents: number } | null;
};

export function DashboardView({ leagueName, isAdmin, inviteCode, week, season, lastWeek }: DashboardData) {
  return (
    <>
      {inviteCode ? (
        <section className="invite-banner">
          <div><span>Your reusable league code</span><strong>{inviteCode}</strong></div>
          <p>Share this with the people you want to join. You can rotate or disable it later.</p>
        </section>
      ) : null}
      {week ? <CurrentWeek leagueName={leagueName} week={week} season={season} /> : (
        <>
          <PageHeading eyebrow={leagueName} title="A new season awaits." />
          <EmptyState
            title={isAdmin ? "Set up the first week." : "No week published yet."}
            action={isAdmin ? <Link href="/admin/weeks" className="button button-primary">Open week setup</Link> : null}
          >
            {isAdmin ? "Import the NFL schedule, enter the official lines, and publish when everything is ready." : "Your commissioner is getting the schedule and official lines ready. Check back soon."}
          </EmptyState>
        </>
      )}
      {lastWeek || season ? (
        <>
          <div className="section-heading"><h2>Around the league</h2><Link href="/history" className="text-link">All weeks</Link></div>
          <div className="dashboard-secondary">
            {lastWeek ? (
              <Link className="recap-card" href={`/live/${lastWeek.id}`}>
                <span className="card-kicker">Last finished · Week {lastWeek.number}</span>
                <h3>{lastWeek.winners.length ? `${joinNames(lastWeek.winners)} went five for five.` : "Nobody went 5–0."}</h3>
                <p>{lastWeek.winners.length ? `${formatMoney(lastWeek.payoutCents)} paid out.` : `${formatMoney(lastWeek.rolloverCents)} rolled into the next jackpot.`}</p>
                <span className="text-link">See every pick <Icon name="arrow" /></span>
              </Link>
            ) : null}
            {season ? (
              <Link className="recap-card" href="/standings">
                <span className="card-kicker">Season leaderboard</span>
                <h3>{season.rank === 1 ? "You’re leading the league." : `You’re #${season.rank} of ${season.players}.`}</h3>
                <p>{season.correct} correct {season.correct === 1 ? "pick" : "picks"} this season.</p>
                <span className="text-link">See the standings <Icon name="arrow" /></span>
              </Link>
            ) : null}
          </div>
        </>
      ) : null}
    </>
  );
}

function CurrentWeek({ leagueName, week, season }: { leagueName: string; week: NonNullable<DashboardData["week"]>; season: DashboardData["season"] }) {
  const entryTitle = week.locked
    ? week.entry ? "Your picks are in. Game on." : "You sat this one out."
    : week.entry ? "Your five are in." : "A perfect week starts with a pick.";
  const entryCopy = week.locked
    ? "See how every entry stacks up against the pool."
    : week.entry ? `Saved${week.entry.submittedAt ? ` ${formatDateTime(week.entry.submittedAt)}` : ""}. You can change them until the deadline.` : "Choose five teams against the official spread, then add your tiebreaker.";
  const cta = week.locked ? "Follow the pool" : week.entry ? "Review picks" : "Make your picks";
  return (
    <>
      <PageHeading eyebrow={leagueName} title={`Week ${week.number}`} action={<Badge tone={week.locked ? "neutral" : "live"}>{week.statusLabel}</Badge>} />
      <section className="week-hero">
        <div className="week-hero-copy">
          <span className="card-kicker">{week.final ? "Final jackpot" : "Current jackpot"}</span>
          <strong className="hero-money">{formatMoney(week.jackpotCents)}</strong>
          <p>{week.jackpotBasis}</p>
          <div className="hero-divider" />
          <span className="card-kicker">{week.locked ? "Picks locked" : "Picks lock"}</span>
          <strong className="hero-deadline">{week.lockAt ? formatDateTime(week.lockAt) : "Set when the week is published"}</strong>
        </div>
        <div className="week-hero-art" aria-hidden="true"><span>Week</span><strong>{String(week.number).padStart(2, "0")}</strong></div>
      </section>
      <section className={`entry-action ${week.entry ? "is-done" : ""}`}>
        <div className="entry-action-icon" aria-hidden="true">{week.entry ? <Icon name="check" /> : "5"}</div>
        <div>
          <span className="card-kicker">Your entry</span>
          <h2>{entryTitle}</h2>
          <p>{entryCopy}</p>
        </div>
        <Link href={week.locked ? `/live/${week.id}` : `/picks/${week.id}`} className="button button-primary">{cta} <Icon name="arrow" /></Link>
      </section>
      <div className="stats-strip">
        <Stat label="Entries in" value={`${week.submittedCount} / ${week.memberCount}`} note={week.locked ? "Picks revealed" : "Picks hidden until lock"} />
        <Stat label="Your season" value={season ? `#${season.rank}` : "—"} note={season ? `${season.correct} correct picks` : "No finished weeks yet"} />
      </div>
    </>
  );
}

function joinNames(names: string[]) {
  return names.length <= 2 ? names.join(" & ") : `${names.slice(0, -1).join(", ")} & ${names.at(-1)}`;
}
