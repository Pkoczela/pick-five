import { redirect } from "next/navigation";
import { CommissionerEntryView } from "@/components/views/picks-view";
import { requireAdminContext } from "@/lib/auth/context";
import { loadCommissionerEntry } from "@/lib/data/picks";
import { isPreviewMode } from "@/lib/preview-mode";
import { getPreviewState } from "@/lib/preview/server";
import { samplePicks } from "@/lib/preview/sample";

export default async function CommissionerEntryPage({ params, searchParams }: PageProps<"/admin/entries/[memberId]">) {
  const { memberId } = await params;
  const { weekId } = await searchParams;
  if (isPreviewMode()) {
    await requireAdminContext();
    return <CommissionerEntryView data={samplePicks(await getPreviewState(), { forOtherPlayer: true })} memberName="Jordan Lee" memberId={memberId} sample />;
  }
  if (typeof weekId !== "string") redirect("/admin/submissions");
  const context = await requireAdminContext();
  const { memberName, ...data } = await loadCommissionerEntry(context, weekId, memberId);
  return <CommissionerEntryView data={data} memberName={memberName} memberId={memberId} />;
}
