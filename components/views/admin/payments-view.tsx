import { Badge, EmptyState, FlashMessages, PageHeading, Stat } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { paymentTotals, type PaymentAmounts } from "@/lib/domain/payments";

export type PaymentsData = {
  week: { id: string; number: number; feeCents: number } | null;
  members: Array<{ id: string; name: string } & PaymentAmounts>;
  error?: string;
  notice?: string;
};

export function PaymentsView({ week, members, error, notice }: PaymentsData) {
  const paid = members.filter((member) => member.status === "PAID").length;
  const totals = paymentTotals(members);
  // Unpaid first: that is the list a commissioner is working through.
  const settled = (status: string) => status === "PAID" || status === "WAIVED";
  const ordered = [...members].sort((a, b) => Number(settled(a.status)) - Number(settled(b.status)) || a.name.localeCompare(b.name));
  return (
    <>
      <PageHeading eyebrow={week ? `Commissioner · Week ${week.number}` : "Commissioner"} title="Entry fees." description="Payment status never changes a submitted pick. Eligibility follows the policy frozen at publish." />
      <FlashMessages error={error} notice={notice} />
      {!week ? <EmptyState title="No published week.">Publish a week to start tracking payments.</EmptyState> : (
        <>
          <div className="stats-strip">
            <Stat label="Paid" value={`${paid} / ${members.length}`} />
            <Stat label="Collected" value={formatMoney(totals.collected)} />
            <Stat label="Outstanding" value={formatMoney(totals.outstanding)} />
          </div>
          <ul className="management-list">
            {ordered.map((member) => (
              <li className="management-row" key={member.id}>
                <div className="person"><span className="avatar" aria-hidden="true">{initials(member.name)}</span><div><strong>{member.name}</strong><p>{formatMoney(member.expectedCents)} fee{member.expectedCents > week.feeCents ? " · includes catch-up" : ""}<br />{formatMoney(member.receivedCents)} received</p></div></div>
                <Badge tone={settled(member.status) ? "success" : "warning"}>{member.status === "PAID" ? "Paid" : member.status === "PARTIAL" ? "Partial" : member.status === "WAIVED" ? "Waived" : "Unpaid"}</Badge>
                <form action="/api/admin/payment" method="post">
                  <input type="hidden" name="weekId" value={week.id} />
                  <input type="hidden" name="memberId" value={member.id} />
                  <input type="hidden" name="paid" value={member.status === "PAID" ? "false" : "true"} />
                  <button className={member.status === "PAID" ? "button button-text" : "button button-quiet"} type="submit">{member.status === "PAID" ? "Undo" : "Mark paid"}<span className="sr-only"> for {member.name}</span></button>
                </form>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}
