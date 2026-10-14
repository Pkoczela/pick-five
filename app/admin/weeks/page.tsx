import { WeeksView } from "@/components/views/admin/weeks-view";
import { requireAdminContext } from "@/lib/auth/context";
import { loadWeeks } from "@/lib/data/admin";
import { readFlash } from "@/lib/flash";
import { isPreviewMode } from "@/lib/preview-mode";
import { getPreviewState } from "@/lib/preview/server";
import { sampleWeeks } from "@/lib/preview/sample";

export default async function AdminWeeksPage({ searchParams }: PageProps<"/admin/weeks">) {
  const context = await requireAdminContext();
  const flash = await readFlash(searchParams);
  if (isPreviewMode()) return <WeeksView {...sampleWeeks(await getPreviewState(), flash)} />;
  return <WeeksView {...await loadWeeks(context, flash)} />;
}
