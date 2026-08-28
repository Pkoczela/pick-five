import Link from "next/link";

type AppShellProps = {
  leagueName: string;
  displayName: string;
  isAdmin: boolean;
  leagueCount: number;
  children: React.ReactNode;
};

export function AppShell({ leagueName, displayName, isAdmin, leagueCount, children }: AppShellProps) {
  return (
    <div className="app-frame">
      <header className="app-header">
        <Link href="/dashboard" className="wordmark">
          <span className="mark" aria-hidden="true">5</span><span>PICK FIVE</span>
        </Link>
        <Link href="/leagues" className="league-chip" aria-label="Switch or manage leagues"><span>{leagueName}</span><strong>{displayName} · {leagueCount > 1 ? "Switch pool" : "Manage pools"}</strong></Link>
      </header>
      <div className="app-layout">
        <nav className="app-nav" aria-label="Pool navigation">
          <Link href="/dashboard">This week</Link>
          <Link href="/standings">Standings</Link>
          <Link href="/history">History</Link>
          {isAdmin ? <Link href="/admin">Commissioner</Link> : null}
          <form action="/api/auth/logout" method="post"><button type="submit">Log out</button></form>
        </nav>
        <main className="app-main">{children}</main>
      </div>
    </div>
  );
}
