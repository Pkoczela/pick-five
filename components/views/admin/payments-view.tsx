import { Badge, EmptyState, FlashMessages, PageHeading, Stat } from "@/components/ui";
import { formatMoney } from "@/lib/format";

export type PaymentsData = {
  week: { id: string; number: number; feeCents: number } | null;
  members: Array<{ id: string; name: string; paid: boolean }>;
  error?: string;
  notice?: string;
};

export function PaymentsView({ week, members, error, notice }: PaymentsData) {
  const paid = members.filter((member) => member.paid).length;
  // Unpaid first: that is the list a commissioner is working through.
  const ordered = [...members].sort((a, b) => Number(a.paid) - Number(b.paid) || a.name.localeCompare(b.name));
  return (
    <>
      <PageHeading eyebrow={week ? `Commissioner · Week ${week.number}` : "Commissioner"} title="Entry fees." description="Payment status never changes a submitted pick. Eligibility follows the policy frozen at publish." />
      <FlashMessages error={error} notice={notice} />
      {!week ? <EmptyState title="No published week.">Publish a week to start tracking payments.</EmptyState> : (
        <>
          <div className="stats-strip">
            <Stat label="Paid" value={`${paid} / ${members.length}`} />
            <Stat label="Collected" value={formatMoney(paid * week.feeCents)} />
            <Stat label="Outstanding" value={formatMoney((members.length - paid) * week.feeCents)} />
          </div>
          <ul className="management-list">
            {ordered.map((member) => (
              <li className="management-row" key={member.id}>
                <div className="person"><span className="avatar" aria-hidden="true">{initials(member.name)}</span><strong>{member.name}</strong></div>
                <Badge tone={member.paid ? "success" : "warning"}>{member.paid ? "Paid" : "Unpaid"}</Badge>
                <form action="/api/admin/payment" method="post">
                  <input type="hidden" name="weekId" value={week.id} />
                  <input type="hidden" name="memberId" value={member.id} />
                  <input type="hidden" name="paid" value={member.paid ? "false" : "true"} />
                  <button className={member.paid ? "button button-text" : "button button-quiet"} type="submit">{member.paid ? "Undo" : "Mark paid"}<span className="sr-only"> for {member.name}</span></button>
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
