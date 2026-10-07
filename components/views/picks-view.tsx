import { PickForm, type PickGame } from "@/components/pick-form";
import { Badge, PageHeading } from "@/components/ui";

export type PicksData = {
  weekId: string;
  weekNumber: number;
  lockAt: string;
  locked: boolean;
  games: PickGame[];
  initialPicks: Record<string, "HOME" | "AWAY">;
  initialTiebreaker: number | null;
  tiebreakerLabel: string;
};

export function PicksView({ data, sample = false }: { data: PicksData; sample?: boolean }) {
  return (
    <>
      <PageHeading
        eyebrow={`Week ${data.weekNumber} · Your entry`}
        title={data.locked ? "Your five, locked in." : "Make your five."}
        description={data.locked ? undefined : "One side from five different games, against the pool’s official spreads."}
        action={<Badge tone={data.locked ? "neutral" : "live"}>{data.locked ? "Locked" : "Open for picks"}</Badge>}
      />
      <PickForm {...data} sample={sample} />
    </>
  );
}

export function CommissionerEntryView({ data, memberName, memberId, sample = false }: { data: PicksData; memberName: string; memberId: string; sample?: boolean }) {
  return (
    <>
      <PageHeading eyebrow={`Week ${data.weekNumber} · Audited commissioner access`} title={`${memberName}’s entry`} description="Opening this page was recorded. Saving requires a reason and creates a before-and-after audit event." />
      <PickForm {...data} locked commissionerEdit={{ memberId }} sample={sample} />
    </>
  );
}
