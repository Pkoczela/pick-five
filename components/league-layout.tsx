import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireLeagueContext } from "@/lib/auth/context";
import { hasSupabaseEnvironment } from "@/lib/env";
import { isPreviewMode } from "@/lib/preview-mode";
import { getPreviewState } from "@/lib/preview/server";

/** Shared shell for every signed-in league page. */
export async function LeagueLayout({ children }: { children: React.ReactNode }) {
  if (isPreviewMode()) {
    const { scenario } = await getPreviewState();
    if (scenario === "Error") throw new Error("Sample error scenario");
    if (scenario === "Loading") await new Promise((resolve) => setTimeout(resolve, 2500));
  } else if (!hasSupabaseEnvironment()) {
    return <SetupRequired />;
  }
  const context = await requireLeagueContext();
  return <AppShell {...context} isAdmin={context.role !== "PLAYER"}>{children}</AppShell>;
}

function SetupRequired() {
  return <main className="setup-state"><p className="eyebrow">LOCAL SETUP</p><h1>Connect Supabase to continue.</h1><p>Copy <code>.env.example</code> to <code>.env.local</code>, add the project credentials, then apply the migrations in <code>supabase/migrations</code>.</p><Link href="/">Return home</Link></main>;
}
