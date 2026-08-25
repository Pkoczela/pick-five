import { NextRequest } from "next/server";
import { createUserClient } from "@/lib/supabase/server";
import { redirectWith } from "@/lib/http/redirect";
export async function POST(request:NextRequest){const form=await request.formData();const weekId=String(form.get("weekId")??"");const reason=String(form.get("reason")??"");const supabase=await createUserClient();const{data,error}=await supabase.rpc("reopen_week_cascade",{p_week_id:weekId,p_reason:reason});if(error)return redirectWith(request,"/admin/results","error",error.message);return redirectWith(request,"/admin/results","notice",`Reopened ${data} affected week(s). Re-finalize them in order.`)}
