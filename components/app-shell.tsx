import Link from "next/link";

type AppShellProps = {
  leagueName: string;
  displayName: string;
  isAdmin: boolean;
  children: React.ReactNode;
};

export function AppShell({ leagueName, displayName, isAdmin, children }: AppShellProps) {
  return (
    <div className="app-frame">
      <header className="app-header">
        <Link href="/dashboard" className="wordmark">
          <span className="mark" aria-hidden="true">5</span><span>PICK FIVE</span>
        </Link>
        <div className="league-chip"><span>{leagueName}</span><strong>{displayName}</strong></div>
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
