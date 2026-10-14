import Link from "next/link";
import type { Route } from "next";
import { Badge, Icon, PageHeading, Stat } from "@/components/ui";

export type AdminOverviewData = {
  leagueName: string;
  week: null | { number: number; status: string; statusLabel: string; submitted: number; members: number; paid: number };
};

const tools: Array<[Route, string, string]> = [
  ["/admin/weeks", "Week setup", "Import the schedule, set official spreads, choose the tiebreaker, and publish."],
  ["/admin/submissions", "Entries", "See who’s in without revealing picks before lock."],
  ["/admin/payments", "Payments", "Mark weekly entry fees paid or unpaid."],
  ["/admin/results", "Scores & results", "Refresh scores, review ATS outcomes, and finalize the jackpot."],
  ["/admin/players", "Players & invite", "Manage members and the reusable league code."],
  ["/admin/audit", "Audit log", "Every fairness, payment, line, invite, and finalization change."],
];

export function AdminOverviewView({ leagueName, week }: AdminOverviewData) {
  const next = !week ? { title: "Create the first week.", copy: "Start a season week, import the NFL schedule, and enter the official lines.", href: "/admin/weeks" as Route, label: "Open week setup" }
    : week.status === "DRAFT" ? { title: "Finish setting up the week.", copy: "Review the official lines, choose the tiebreaker, then publish to open entries.", href: "/admin/weeks" as Route, label: "Continue week setup" }
    : week.status === "OPEN" ? { title: "Entries are open.", copy: `${week.members - week.submitted} ${week.members - week.submitted === 1 ? "player hasn’t" : "players haven’t"} submitted yet.`, href: "/admin/submissions" as Route, label: "Check entries" }
    : week.status === "FINAL" ? { title: "This week is final.", copy: "Create the next week when the schedule is ready.", href: "/admin/weeks" as Route, label: "Set up next week" }
    : { title: "Games are underway.", copy: "Refresh scores as games finish, then finalize the jackpot.", href: "/admin/results" as Route, label: "Review results" };
  return (
    <>
      <PageHeading eyebrow={`Commissioner · ${leagueName}`} title="Run the pool." action={week ? <Badge tone={week.status === "OPEN" ? "live" : week.status === "DRAFT" ? "warning" : "neutral"}>Week {week.number} · {week.statusLabel}</Badge> : null} />
      <section className="next-step-card">
        <div><p className="eyebrow">Next step</p><h2>{next.title}</h2><p>{next.copy}</p></div>
        <Link href={next.href} className="button button-primary">{next.label} <Icon name="arrow" /></Link>
      </section>
      {week && week.status !== "DRAFT" ? (
        <div className="stats-strip">
          <Stat label="Submitted" value={`${week.submitted} / ${week.members}`} />
          <Stat label="Fees paid" value={`${week.paid} / ${week.members}`} />
          <Stat label="Week" value={week.number} note={week.statusLabel} />
        </div>
      ) : null}
      <div className="tool-grid">
        {tools.map(([href, title, description]) => (
          <Link href={href} className="tool-card" key={href}><h2>{title}</h2><p>{description}</p><span className="tool-arrow" aria-hidden="true"><Icon name="arrow" /></span></Link>
        ))}
      </div>
    </>
  );
}
