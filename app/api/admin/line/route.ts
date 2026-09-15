import { NextRequest } from "next/server";
import { z } from "zod";
import { parseOfficialLineUpdates } from "@/lib/domain/spreads";
import { createUserClient } from "@/lib/supabase/server";
import { redirectWith } from "@/lib/http/redirect";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const weekId = z.string().uuid().safeParse(String(form.get("weekId") ?? ""));
  if (!weekId.success) return redirectWith(request, "/admin/weeks", "error", "Invalid week.");
  const reason = String(form.get("reason") ?? "").trim();
  let lines;
  try {
    lines = parseOfficialLineUpdates(form.getAll("gameId").map(String), form.getAll("homeSpread").map(String));
  } catch (error) {
    return redirectWith(request, "/admin/weeks", "error", error instanceof Error ? error.message : "Invalid spreads.");
  }
  const supabase = await createUserClient();
  const { data: updated, error } = await supabase.rpc("set_official_lines_bulk", { p_week_id: weekId.data, p_lines: lines, p_reason: reason || null });
  if (error) return redirectWith(request, "/admin/weeks", "error", error.message);
  const count = Number(updated ?? 0);
  return redirectWith(request, "/admin/weeks", "notice", count === 0 ? "All spreads were already up to date." : `${count} spread${count === 1 ? "" : "s"} saved.`);
}
