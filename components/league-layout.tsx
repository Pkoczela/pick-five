import { AppShell } from "@/components/app-shell";
import { requireLeagueContext } from "@/lib/auth/context";

export async function LeagueLayout({ children }: { children: React.ReactNode }) {
  const context = await requireLeagueContext();
  return <AppShell {...context} isAdmin={context.role !== "PLAYER"} nestedMain>{children}</AppShell>;
}
