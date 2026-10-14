import { AuditView } from "@/components/views/admin/audit-view";
import { requireAdminContext } from "@/lib/auth/context";
import { loadAudit } from "@/lib/data/admin";
import { isPreviewMode } from "@/lib/preview-mode";
import { getPreviewState } from "@/lib/preview/server";
import { sampleAudit } from "@/lib/preview/sample";

export default async function AuditPage() {
  const context = await requireAdminContext();
  if (isPreviewMode()) return <AuditView {...sampleAudit(await getPreviewState())} />;
  return <AuditView {...await loadAudit(context)} />;
}
