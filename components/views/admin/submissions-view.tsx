import Link from "next/link";
import { Badge, EmptyState, PageHeading, Stat } from "@/components/ui";
import { initials } from "@/components/views/admin/payments-view";
import { formatDateTime } from "@/lib/format";

export type SubmissionsData = {
  week: { id: string; number: number } | null;
  members: Array<{ id: string; name: string; submitted: boolean; submittedAt: string | null; paid: boolean }>;
};

export function SubmissionsView({ week, members }: SubmissionsData) {
  const submitted = members.filter((member) => member.submitted).length;
  const ordered = [...members].sort((a, b) => Number(a.submitted) - Number(b.submitted) || a.name.localeCompare(b.name));
  return (
    <>
      <PageHeading eyebrow={week ? `Commissioner · Week ${week.number}` : "Commissioner"} title="Who’s in?" description="Before lock this shows submission status only. Opening someone’s picks is recorded in the audit log." />
      {!week ? <EmptyState title="No published week.">Publish a week to track submissions.</EmptyState> : (
        <>
          <div className="stats-strip">
            <Stat label="Submitted" value={`${submitted} / ${members.length}`} />
            <Stat label="Missing" value={members.length - submitted} />
            <Stat label="Unpaid" value={members.filter((member) => !member.paid).length} />
          </div>
          <ul className="management-list">
            {ordered.map((member) => (
              <li className="management-row" key={member.id}>
                <div className="person"><span className="avatar" aria-hidden="true">{initials(member.name)}</span><div><strong>{member.name}</strong><small>{member.submitted ? `Submitted${member.submittedAt ? ` ${formatDateTime(member.submittedAt)}` : ""}` : "No entry yet"}{member.paid ? "" : " · Unpaid"}</small></div></div>
                <Badge tone={member.submitted ? "success" : "warning"}>{member.submitted ? "Submitted" : "Missing"}</Badge>
                <Link className="button button-text" href={`/admin/entries/${member.id}?weekId=${week.id}`}>Open entry<span className="sr-only"> for {member.name} (audited)</span></Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
