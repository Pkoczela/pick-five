import { LiveView } from "@/components/views/live-view";
import { requireLeagueContext } from "@/lib/auth/context";
import { loadLive } from "@/lib/data/live";
import { isPreviewMode } from "@/lib/preview-mode";
import { getPreviewState } from "@/lib/preview/server";
import { sampleLiveSnapshot } from "@/lib/preview/sample";

export default async function LivePage({ params }: PageProps<"/live/[weekId]">) {
  const { weekId } = await params;
  if (isPreviewMode()) {
    const state = await getPreviewState();
    return <LiveView key={`${weekId}-${state.scenario}-${state.formRevision}`} {...sampleLiveSnapshot(state, weekId)} />;
  }
  return <LiveView key={weekId} {...await loadLive(await requireLeagueContext(), weekId)} />;
}
