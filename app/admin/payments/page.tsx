import { PaymentsView } from "@/components/views/admin/payments-view";
import { requireAdminContext } from "@/lib/auth/context";
import { loadPayments } from "@/lib/data/admin";
import { readFlash } from "@/lib/flash";
import { isPreviewMode } from "@/lib/preview-mode";
import { getPreviewState } from "@/lib/preview/server";
import { samplePayments } from "@/lib/preview/sample";

export default async function PaymentsPage({ searchParams }: PageProps<"/admin/payments">) {
  const context = await requireAdminContext();
  const flash = await readFlash(searchParams);
  if (isPreviewMode()) return <PaymentsView {...samplePayments(await getPreviewState(), flash)} />;
  return <PaymentsView {...await loadPayments(context, flash)} />;
}
