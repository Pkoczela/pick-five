import { StandingsView } from "@/components/views/standings-view";
import { requireLeagueContext } from "@/lib/auth/context";
import { loadStandings } from "@/lib/data/standings";
import { isPreviewMode } from "@/lib/preview-mode";
import { getPreviewState } from "@/lib/preview/server";
import { sampleStandings } from "@/lib/preview/sample";

export default async function StandingsPage() {
  if (isPreviewMode()) return <StandingsView {...sampleStandings(await getPreviewState())} />;
  return <StandingsView {...await loadStandings(await requireLeagueContext())} />;
}
