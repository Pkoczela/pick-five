import type { ReactNode } from "react";

export function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description ? <p className="heading-description">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "live";
export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: BadgeTone }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Notice({ children, tone = "success" }: { children: ReactNode; tone?: "success" | "error" | "info" }) {
  return <div className={`notice notice-${tone}`} role={tone === "error" ? "alert" : "status"}>{children}</div>;
}

/** Server redirects report outcomes through ?error= / ?notice= query params. */
export function FlashMessages({ error, notice }: { error?: string; notice?: string }) {
  return <>{error ? <Notice tone="error">{error}</Notice> : null}{notice ? <Notice>{notice}</Notice> : null}</>;
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <section className="empty-panel">
      <span className="empty-symbol" aria-hidden="true">5</span>
      <h2>{title}</h2>
      {children ? <p>{children}</p> : null}
      {action}
    </section>
  );
}

export function Stat({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return <div className="stat"><span>{label}</span><strong>{value}</strong>{note ? <small>{note}</small> : null}</div>;
}

const iconPaths = {
  week: <><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  standings: <><path d="M5 20V11M12 20V5M19 20v-6" /></>,
  history: <><path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5" /><path d="M4 4v4.5h4.5M12 8v4.5l3 2" /></>,
  more: <><circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" /></>,
  leagues: <><circle cx="9" cy="9" r="3.5" /><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 5.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.8.8 3 2.5 3.5 5.2" /></>,
  commissioner: <><path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6z" /><path d="M8.8 12l2.2 2.2 4.4-4.4" /></>,
  logout: <><path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14M10 16l-4-4 4-4M6 12h10" /></>,
  check: <><path d="M5 12.5l4.5 4.5L19 7.5" /></>,
  arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  theme: <><circle cx="12" cy="12" r="8" /><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none" /></>,
} as const;

export type IconName = keyof typeof iconPaths;
export function Icon({ name }: { name: IconName }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {iconPaths[name]}
    </svg>
  );
}
