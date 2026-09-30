"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Route } from "next";

const destinations = [["/dashboard", "This week", "◷"], ["/standings", "Standings", "≡"], ["/history", "History", "↶"]] as const;
export function Navigation({ isAdmin, preview = false }: { isAdmin: boolean; preview?: boolean }) {
  const pathname = usePathname().replace(/^\/preview/, "") || "/dashboard";
  const [more, setMore] = useState(false);
  const active = (href: string) => href === "/dashboard" ? ["/dashboard", "/"].includes(pathname) || pathname.startsWith("/picks/") || pathname.startsWith("/live/") : pathname.startsWith(href);
  return <>
    <nav className="app-nav" aria-label="Pool navigation">
      <span className="nav-caption">YOUR POOL</span>
      {destinations.map(([href, label, icon]) => <Link key={href} href={href} aria-current={active(href) ? "page" : undefined} onClick={() => setMore(false)}><span className="nav-icon" aria-hidden="true">{icon}</span>{label}</Link>)}
      <button className="mobile-more" aria-expanded={more} aria-controls="more-menu" onClick={() => setMore(!more)}><span className="nav-icon" aria-hidden="true">•••</span>More</button>
      <div className={`nav-secondary ${more ? "is-open" : ""}`} id="more-menu">
        <span className="nav-caption">MANAGE</span>
        <Link href="/leagues" aria-current={active("/leagues") ? "page" : undefined} onClick={() => setMore(false)}>Your leagues <span aria-hidden="true">↗</span></Link>
        {isAdmin && <Link href="/admin" aria-current={active("/admin") ? "page" : undefined} onClick={() => setMore(false)}>Commissioner <span aria-hidden="true">↗</span></Link>}
        {preview ? <Link href="/login" onClick={() => setMore(false)}>Sign-in preview</Link> : <form action="/api/auth/logout" method="post"><button type="submit">Log out</button></form>}
      </div>
      <div className="nav-footnote">FIVE PICKS.<br/>ONE PERFECT WEEK.</div>
    </nav>
    {isAdmin && pathname.startsWith("/admin") && <nav className="commissioner-nav" aria-label="Commissioner tools">{[["/admin", "Overview"], ["/admin/weeks", "Week setup"], ["/admin/submissions", "Entries"], ["/admin/payments", "Payments"], ["/admin/results", "Results"], ["/admin/players", "Players"], ["/admin/audit", "Audit"]].map(([href, label]) => <Link key={href} href={href as Route} aria-current={pathname === href ? "page" : undefined}>{label}</Link>)}</nav>}
  </>;
}
