import { SubmissionsView } from "@/components/views/admin/submissions-view";
import { requireAdminContext } from "@/lib/auth/context";
import { loadSubmissions } from "@/lib/data/admin";
import { isPreviewMode } from "@/lib/preview-mode";
import { getPreviewState } from "@/lib/preview/server";
import { sampleSubmissions } from "@/lib/preview/sample";

export default async function SubmissionsPage() {
  const context = await requireAdminContext();
  if (isPreviewMode()) return <SubmissionsView {...sampleSubmissions(await getPreviewState())} />;
  return <SubmissionsView {...await loadSubmissions(context)} />;
}
