import Link from "next/link";
import { requireAdminContext } from "@/lib/auth/context";
export default async function SpreadsPage() { await requireAdminContext(); return <main className="standalone-page"><Link href="/admin" className="back-link">← Commissioner</Link><p className="eyebrow">OFFICIAL LINES</p><h1>Set the spreads.</h1><p className="page-lede">Spreads are managed alongside each draft week so the schedule, line completeness, and publish readiness stay together.</p><Link href="/admin/weeks" className="button button-primary">Open week setup</Link></main>; }
