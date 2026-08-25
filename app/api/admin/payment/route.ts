import { NextRequest } from "next/server";
import { z } from "zod";
import { createUserClient } from "@/lib/supabase/server";
import { redirectWith } from "@/lib/http/redirect";

const schema = z.object({ weekId: z.uuid(), memberId: z.uuid(), paid: z.enum(["true", "false"]).transform((value) => value === "true"), note: z.string().max(200).optional() });
export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return redirectWith(request, "/admin/payments", "error", "Invalid payment update.");
  const supabase = await createUserClient();
  const { error } = await supabase.rpc("set_week_payment", { p_week_id: parsed.data.weekId, p_member_id: parsed.data.memberId, p_paid: parsed.data.paid, p_note: parsed.data.note || null });
  if (error) return redirectWith(request, "/admin/payments", "error", error.message);
  return redirectWith(request, "/admin/payments", "notice", "Payment status updated.");
}
