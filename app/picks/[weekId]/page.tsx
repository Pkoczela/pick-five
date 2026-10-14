import { PicksView } from "@/components/views/picks-view";
import { requireLeagueContext } from "@/lib/auth/context";
import { loadPicks } from "@/lib/data/picks";
import { isPreviewMode } from "@/lib/preview-mode";
import { getPreviewState } from "@/lib/preview/server";
import { samplePicks } from "@/lib/preview/sample";

export default async function PicksPage({ params }: PageProps<"/picks/[weekId]">) {
  if (isPreviewMode()) return <PicksView data={samplePicks(await getPreviewState())} sample />;
  const { weekId } = await params;
  return <PicksView data={await loadPicks(await requireLeagueContext(), weekId)} />;
}
