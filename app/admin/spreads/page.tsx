import { redirect } from "next/navigation";

/** Spreads are edited alongside the schedule in week setup. */
export default function SpreadsPage() {
  redirect("/admin/weeks");
}
