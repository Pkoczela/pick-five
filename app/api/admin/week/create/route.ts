import { NextRequest } from "next/server";
import { z } from "zod";
import { createUserClient } from "@/lib/supabase/server";
import { redirectWith } from "@/lib/http/redirect";

const schema = z.object({
  year: z.coerce.number().int().min(2020).max(2200),
  nflWeek: z.coerce.number().int().min(1).max(22),
  seasonType: z.coerce.number().int().min(1).max(3),
  entryFeeDollars: z.coerce.number().min(0).max(10000),
});

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return redirectWith(request, "/admin/weeks", "error", parsed.error.issues[0]?.message ?? "Invalid week details");
  const supabase = await createUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirectWith(request, "/login", "error", "Log in to continue.");
  const { data: member } = await supabase.from("league_members").select("league_id, role").eq("user_id", user.id).eq("active", true).limit(1).maybeSingle();
  if (!member || !["OWNER", "COMMISSIONER"].includes(member.role)) return redirectWith(request, "/dashboard", "error", "Commissioner access required.");

  let { data: season } = await supabase.from("seasons").select("id").eq("league_id", member.league_id).eq("year", parsed.data.year).maybeSingle();
  if (!season) {
    const created = await supabase.from("seasons").insert({ league_id: member.league_id, year: parsed.data.year, name: `${parsed.data.year} NFL Season`, status: "ACTIVE" }).select("id").single();
    if (created.error) return redirectWith(request, "/admin/weeks", "error", created.error.message);
    season = created.data;
  }
  const entryFeeCents = Math.round(parsed.data.entryFeeDollars * 100);
  const { error } = await supabase.from("weeks").insert({
    season_id: season.id,
    nfl_week: parsed.data.nflWeek,
    season_type: parsed.data.seasonType,
    default_entry_fee_cents: entryFeeCents,
  });
  if (error) return redirectWith(request, "/admin/weeks", "error", error.message);
  return redirectWith(request, "/admin/weeks", "notice", `Week ${parsed.data.nflWeek} created.`);
}
