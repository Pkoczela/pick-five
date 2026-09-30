import Link from "next/link";
import { Navigation } from "@/components/navigation";

type AppShellProps = {
  leagueName: string;
  displayName: string;
  isAdmin: boolean;
  leagueCount: number;
  children: React.ReactNode;
  preview?: boolean;
  nestedMain?: boolean;
};

export function AppShell({ leagueName, displayName, isAdmin, leagueCount, children, preview = false, nestedMain = false }: AppShellProps) {
  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="app-header">
        <Link href="/dashboard" className="wordmark">
          <span className="mark" aria-hidden="true">5</span><span>PICK FIVE</span>
        </Link>
        <Link href="/leagues" className="league-chip" aria-label="Switch or manage leagues"><span>{leagueName}</span><strong>{displayName} · {leagueCount > 1 ? "Switch pool" : "Manage pools"}</strong></Link>
      </header>
      <div className="app-layout">
        <Navigation isAdmin={isAdmin} preview={preview} />
        {nestedMain ? <div className="app-main" id="main-content" tabIndex={-1}>{children}</div> : <main className="app-main" id="main-content" tabIndex={-1}>{children}</main>}
      </div>
    </div>
  );
}
