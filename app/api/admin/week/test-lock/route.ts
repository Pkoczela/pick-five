import { NextRequest } from "next/server";
import { z } from "zod";
import { redirectWith } from "@/lib/http/redirect";
import { createUserClient } from "@/lib/supabase/server";

const schema = z.object({
  weekId: z.string().uuid(),
  action: z.enum(["start", "end"]),
  reason: z.string().trim().min(3, "Enter a short reason for the audit log.").max(300),
  acknowledge: z.enum(["yes"]).optional(),
}).superRefine((value, context) => {
  if (value.action === "start" && value.acknowledge !== "yes") {
    context.addIssue({ code: "custom", path: ["acknowledge"], message: "Confirm that this week contains test picks before revealing them." });
  }
});

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) {
    return redirectWith(request, "/admin/weeks", "error", parsed.error.issues[0]?.message ?? "Invalid test request");
  }

  const supabase = await createUserClient();
  const rpc = parsed.data.action === "start" ? "start_week_lock_test" : "end_week_lock_test";
  const { error } = await supabase.rpc(rpc, {
    p_week_id: parsed.data.weekId,
    p_reason: parsed.data.reason,
  });

  if (error) return redirectWith(request, "/admin/weeks", "error", error.message);
  const notice = parsed.data.action === "start"
    ? "Locked-board test started. Every league member can now see submitted picks."
    : "Test ended. The original deadline is restored and players can edit again.";
  return redirectWith(request, "/admin/weeks", "notice", notice);
}
