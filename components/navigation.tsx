"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Icon, type IconName } from "@/components/ui";
import type { Theme } from "@/lib/theme";

const destinations: Array<[Route, string, IconName]> = [["/dashboard", "This week", "week"], ["/standings", "Standings", "standings"], ["/history", "History", "history"]];
const commissionerTools: Array<[Route, string]> = [["/admin", "Overview"], ["/admin/weeks", "Week setup"], ["/admin/submissions", "Entries"], ["/admin/payments", "Payments"], ["/admin/results", "Results"], ["/admin/players", "Players"], ["/admin/audit", "Audit"]];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard" || pathname.startsWith("/picks/") || pathname.startsWith("/live/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Navigation({ isAdmin, theme }: { isAdmin: boolean; theme: Theme }) {
  const pathname = usePathname();
  // Remember where the menu was opened; navigating anywhere else closes it.
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const menuOpen = openedAt === pathname;
  const setMenuOpen = (open: boolean) => setOpenedAt(open ? pathname : null);
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpenedAt(null);
      toggleRef.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !toggleRef.current?.contains(target)) setOpenedAt(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onPointer); };
  }, [menuOpen]);

  const secondaryActive = isActive(pathname, "/leagues") || isActive(pathname, "/admin");
  return (
    <nav className="app-nav" aria-label="Pool navigation">
      <span className="nav-caption">Your pool</span>
      {destinations.map(([href, label, icon]) => (
        <Link key={href} href={href} className="nav-link" aria-current={isActive(pathname, href) ? "page" : undefined}><Icon name={icon} />{label}</Link>
      ))}
      <button ref={toggleRef} type="button" className="nav-link mobile-more" aria-expanded={menuOpen} aria-controls="more-menu" aria-current={secondaryActive ? "true" : undefined} onClick={() => setMenuOpen(!menuOpen)}>
        <Icon name="more" />More
      </button>
      <div ref={menuRef} className={`nav-secondary ${menuOpen ? "is-open" : ""}`} id="more-menu">
        <span className="nav-caption">Manage</span>
        <Link href="/leagues" className="nav-link" aria-current={isActive(pathname, "/leagues") ? "page" : undefined}><Icon name="leagues" />Your leagues</Link>
        {isAdmin ? <Link href="/admin" className="nav-link" aria-current={isActive(pathname, "/admin") ? "page" : undefined}><Icon name="commissioner" />Commissioner</Link> : null}
        <ThemeSwitcher initial={theme} />
        <form action="/api/auth/logout" method="post"><button type="submit" className="nav-link"><Icon name="logout" />Log out</button></form>
      </div>
    </nav>
  );
}

export function CommissionerNav() {
  const pathname = usePathname();
  if (!pathname.startsWith("/admin")) return null;
  return (
    <nav className="commissioner-nav" aria-label="Commissioner tools">
      {commissionerTools.map(([href, label]) => (
        <Link key={href} href={href} aria-current={(href === "/admin" ? pathname === href : isActive(pathname, href)) ? "page" : undefined}>{label}</Link>
      ))}
    </nav>
  );
}
