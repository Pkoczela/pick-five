import type { ReactNode } from "react";

export function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{description && <p className="heading-description">{description}</p>}</div>{action}</div>;
}
export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" | "live" }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
export function Notice({ children, tone = "success" }: { children: ReactNode; tone?: "success" | "error" | "info" }) {
  return <div className={`notice notice-${tone}`} role={tone === "error" ? "alert" : "status"}>{children}</div>;
}
export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return <section className="empty-panel"><span className="empty-symbol" aria-hidden="true">5</span><h2>{title}</h2><p>{children}</p>{action}</section>;
}
export function Stat({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return <div className="stat"><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</div>;
}
