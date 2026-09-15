import { NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createUserClient } from "@/lib/supabase/server";
import { EspnNflProvider } from "@/lib/providers/espn";
import { calculateAtsResult, scorePick } from "@/lib/domain/scoring";
import { redirectWith } from "@/lib/http/redirect";
import { requireAdminContext } from "@/lib/auth/context";

const schema = z.object({ weekId: z.uuid(), year: z.coerce.number().int(), nflWeek: z.coerce.number().int(), seasonType: z.coerce.number().int() });
export async function POST(request: NextRequest) {
  const parsed=schema.safeParse(Object.fromEntries(await request.formData())); if(!parsed.success) return redirectWith(request,"/admin/results","error","Invalid refresh request.");
  const context=await requireAdminContext(); const userClient=await createUserClient();
  const{data:rawWeek}=await userClient.from("weeks").select("id,season:seasons!inner(league_id)").eq("id",parsed.data.weekId).maybeSingle(); const week=rawWeek as unknown as {id:string;season:{league_id:string}|null}|null;
  if(!week?.season||week.season.league_id!==context.leagueId)return redirectWith(request,"/admin/results","error","That week does not belong to the selected league.");
  try {
    const external=await new EspnNflProvider().getWeekSchedule({year:parsed.data.year,week:parsed.data.nflWeek,seasonType:parsed.data.seasonType}); const byId=new Map(external.map(game=>[game.externalEventId,game])); const admin=createAdminClient();
    const {data:games}=await admin.from("games").select("id, external_event_id, score_override, home_score, away_score, official_lines(home_spread,is_current), game_results(override)").eq("week_id",parsed.data.weekId);
    for(const game of games??[]){ const ext=game.external_event_id?byId.get(game.external_event_id):null; if(ext&&!game.score_override) await admin.from("games").update({status:ext.status,home_score:ext.home.score,away_score:ext.away.score,last_synced_at:new Date().toISOString()}).eq("id",game.id); const home=game.score_override?game.home_score:ext?.home.score; const away=game.score_override?game.away_score:ext?.away.score; const status=game.score_override?"FINAL":ext?.status; const line=(game.official_lines as Array<{home_spread:number;is_current:boolean}>|null)?.find(item=>item.is_current); const overridden=(game.game_results as unknown as {override:boolean}|null)?.override;
      if(status==="FINAL"&&home!==null&&home!==undefined&&away!==null&&away!==undefined&&line&&!overridden){ const ats=calculateAtsResult(home,away,Number(line.home_spread)); await admin.from("game_results").upsert({game_id:game.id,ats_result:ats,calculated_from_score:true,override:false,updated_at:new Date().toISOString()}); const {data:picks}=await admin.from("picks").select("id,selected_side").eq("game_id",game.id); for(const pick of picks??[]) await admin.from("picks").update({result:scorePick(pick.selected_side,ats),updated_at:new Date().toISOString()}).eq("id",pick.id); }
    }
    await admin.from("entries").update({status:"LOCKED"}).eq("week_id",parsed.data.weekId).eq("status","SUBMITTED");
    return redirectWith(request,"/admin/results","notice","Scores and ATS results refreshed.");
  }catch(error){return redirectWith(request,"/admin/results","error",error instanceof Error?error.message:"Score refresh failed.");}
}
