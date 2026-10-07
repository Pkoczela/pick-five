import Link from "next/link";
import { cookies } from "next/headers";
import { CommissionerNav, Navigation } from "@/components/navigation";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";

type AppShellProps = {
  leagueName: string;
  displayName: string;
  isAdmin: boolean;
  leagueCount: number;
  children: React.ReactNode;
};

export async function AppShell({ leagueName, displayName, isAdmin, leagueCount, children }: AppShellProps) {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="app-header">
        <Link href="/dashboard" className="wordmark">
          <span className="mark" aria-hidden="true">5</span><span>PICK FIVE</span>
        </Link>
        <Link href="/leagues" className="league-chip" aria-label={`${leagueName}, playing as ${displayName}. ${leagueCount > 1 ? "Switch pool" : "Manage pools"}`}>
          <span>{leagueName}</span><strong>{displayName}</strong>
        </Link>
      </header>
      <div className="app-layout">
        <Navigation isAdmin={isAdmin} theme={theme} />
        <main className="app-main" id="main-content" tabIndex={-1}>
          {isAdmin ? <CommissionerNav /> : null}
          {children}
        </main>
      </div>
    </div>
  );
}
