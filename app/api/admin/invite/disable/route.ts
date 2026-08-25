import { NextRequest } from "next/server";
import { createUserClient } from "@/lib/supabase/server";
import { redirectWith } from "@/lib/http/redirect";
export async function POST(request:NextRequest){const form=await request.formData();const leagueId=String(form.get("leagueId")??"");const supabase=await createUserClient();const{error}=await supabase.rpc("disable_league_invite",{p_league_id:leagueId});if(error)return redirectWith(request,"/admin/players","error",error.message);return redirectWith(request,"/admin/players","notice","Invitation code disabled.")}
