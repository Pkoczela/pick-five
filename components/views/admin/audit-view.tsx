import { EmptyState, PageHeading } from "@/components/ui";
import { formatTimestamp, humanize } from "@/lib/format";

export type AuditData = { events: Array<{ id: string; type: string; entity: string; reason: string | null; createdAt: string }> };

export function AuditView({ events }: AuditData) {
  return (
    <>
      <PageHeading eyebrow="Commissioner · Audit log" title="Every sensitive change." description="Newest first. Events are append-only and visible only to commissioners." />
      {events.length ? (
        <ol className="audit-list">
          {events.map((event) => (
            <li key={event.id}>
              <div><strong>{humanize(event.type)}</strong><span>{humanize(event.entity)}</span></div>
              <p>{event.reason || "No additional note"}</p>
              <time dateTime={event.createdAt}>{formatTimestamp(event.createdAt)}</time>
            </li>
          ))}
        </ol>
      ) : <EmptyState title="No audited events yet." />}
    </>
  );
}
