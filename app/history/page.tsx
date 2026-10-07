import { HistoryView } from "@/components/views/history-view";
import { requireLeagueContext } from "@/lib/auth/context";
import { loadHistory } from "@/lib/data/history";
import { isPreviewMode } from "@/lib/preview-mode";
import { getPreviewState } from "@/lib/preview/server";
import { sampleHistory } from "@/lib/preview/sample";

export default async function HistoryPage() {
  if (isPreviewMode()) return <HistoryView {...sampleHistory(await getPreviewState())} />;
  return <HistoryView {...await loadHistory(await requireLeagueContext())} />;
}
