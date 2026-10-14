import { LiveView } from "@/components/views/live-view";
import { requireLeagueContext } from "@/lib/auth/context";
import { loadLive } from "@/lib/data/live";
import { isPreviewMode } from "@/lib/preview-mode";
import { getPreviewState } from "@/lib/preview/server";
import { sampleLive } from "@/lib/preview/sample";

export default async function LivePage({ params }: PageProps<"/live/[weekId]">) {
  const { weekId } = await params;
  if (isPreviewMode()) return <LiveView {...sampleLive(await getPreviewState(), weekId)} />;
  return <LiveView {...await loadLive(await requireLeagueContext(), weekId)} />;
}
