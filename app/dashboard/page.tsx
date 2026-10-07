import { DashboardView } from "@/components/views/dashboard-view";
import { requireLeagueContext } from "@/lib/auth/context";
import { loadDashboard } from "@/lib/data/dashboard";
import { isPreviewMode } from "@/lib/preview-mode";
import { getPreviewState } from "@/lib/preview/server";
import { sampleDashboard } from "@/lib/preview/sample";

export default async function DashboardPage() {
  if (isPreviewMode()) return <DashboardView {...sampleDashboard(await getPreviewState())} />;
  return <DashboardView {...await loadDashboard(await requireLeagueContext())} />;
}
