import { NextRequest } from "next/server";
import { z } from "zod";
import { redirectWith } from "@/lib/http/redirect";
import { createUserClient } from "@/lib/supabase/server";

const schema = z.object({ weekId: z.string().uuid(), reason: z.string().trim().min(3).max(300) });

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return redirectWith(request, "/admin/results", "error", parsed.error.issues[0]?.message ?? "Invalid reset request");
  const supabase = await createUserClient();
  const { error } = await supabase.rpc("reset_week_simulation", { p_week_id: parsed.data.weekId, p_reason: parsed.data.reason });
  if (error) return redirectWith(request, "/admin/results", "error", error.message);
  return redirectWith(request, "/admin/weeks", "notice", "Simulation data cleared and the real week restored.");
}
