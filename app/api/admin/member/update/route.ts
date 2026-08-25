import { NextRequest } from "next/server";
import { z } from "zod";
import { createUserClient } from "@/lib/supabase/server";
import { redirectWith } from "@/lib/http/redirect";
const schema=z.object({memberId:z.uuid(),role:z.enum(["OWNER","COMMISSIONER","PLAYER"]),active:z.enum(["true","false"]).transform(value=>value==="true")});
export async function POST(request:NextRequest){const parsed=schema.safeParse(Object.fromEntries(await request.formData()));if(!parsed.success)return redirectWith(request,"/admin/players","error","Invalid member update.");const supabase=await createUserClient();const{error}=await supabase.rpc("update_league_member",{p_member_id:parsed.data.memberId,p_role:parsed.data.role,p_active:parsed.data.active});if(error)return redirectWith(request,"/admin/players","error",error.message);return redirectWith(request,"/admin/players","notice","Member access updated.")}
