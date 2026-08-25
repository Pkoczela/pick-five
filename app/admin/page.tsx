import Link from "next/link";
import { requireAdminContext } from "@/lib/auth/context";

const tools = [
  ["Week setup", "Import the NFL schedule, choose the tiebreaker game, and publish.", "/admin/weeks"],
  ["Official spreads", "Enter and review the frozen pool line for every matchup.", "/admin/spreads"],
  ["Submissions", "See who has submitted without casually exposing their picks.", "/admin/submissions"],
  ["Payments", "Mark weekly entry fees paid or unpaid.", "/admin/payments"],
  ["Players & invite", "Review members and rotate or disable the reusable league code.", "/admin/players"],
  ["Scores & results", "Refresh ESPN scores, review ATS outcomes, and finalize the jackpot.", "/admin/results"],
  ["Audit log", "Review every fairness, payment, line, invite, and finalization change.", "/admin/audit"],
] as const;

export default async function AdminPage() {
  const context = await requireAdminContext();
  return (
    <main className="standalone-page">
      <Link href="/dashboard" className="back-link">← Back to this week</Link>
      <p className="eyebrow">COMMISSIONER · {context.leagueName.toUpperCase()}</p>
      <h1>Run the pool.</h1>
      <div className="tool-grid">
        {tools.map(([title, description, href]) => (
          <Link href={href} className="tool-card" key={title}><h2>{title}</h2><p>{description}</p><span>Open →</span></Link>
        ))}
      </div>
    </main>
  );
}
