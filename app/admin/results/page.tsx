import { ResultsView } from "@/components/views/admin/results-view";
import { requireAdminContext } from "@/lib/auth/context";
import { loadResults } from "@/lib/data/admin";
import { readFlash } from "@/lib/flash";
import { isPreviewMode } from "@/lib/preview-mode";
import { getPreviewState } from "@/lib/preview/server";
import { sampleResults } from "@/lib/preview/sample";

export default async function AdminResultsPage({ searchParams }: PageProps<"/admin/results">) {
  const context = await requireAdminContext();
  const flash = await readFlash(searchParams);
  if (isPreviewMode()) return <ResultsView {...sampleResults(await getPreviewState(), flash)} />;
  return <ResultsView {...await loadResults(context, flash)} />;
}
