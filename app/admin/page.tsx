import { AdminOverviewView } from "@/components/views/admin/overview-view";
import { requireAdminContext } from "@/lib/auth/context";
import { loadAdminOverview } from "@/lib/data/admin";
import { isPreviewMode } from "@/lib/preview-mode";
import { getPreviewState } from "@/lib/preview/server";
import { sampleAdminOverview } from "@/lib/preview/sample";

export default async function AdminPage() {
  const context = await requireAdminContext();
  if (isPreviewMode()) return <AdminOverviewView {...sampleAdminOverview(await getPreviewState())} />;
  return <AdminOverviewView {...await loadAdminOverview(context)} />;
}
