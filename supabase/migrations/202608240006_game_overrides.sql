create or replace function public.override_game_result(
  p_game_id uuid,
  p_home_score integer,
  p_away_score integer,
  p_ats_result public.ats_result,
  p_reason text
) returns void language plpgsql security definer set search_path='' as $$
declare v_game public.games;v_week public.weeks;v_league_id uuid;v_before jsonb;
begin
  select * into v_game from public.games where id=p_game_id for update;
  if v_game.id is null then raise exception 'Game not found'; end if;
  select * into v_week from public.weeks where id=v_game.week_id;
  v_league_id:=public.week_league_id(v_game.week_id);
  if not public.is_league_admin(v_league_id) then raise exception 'Not authorized'; end if;
  if v_week.status='FINAL' then raise exception 'Reopen the final week before overriding a game'; end if;
  if nullif(trim(p_reason),'') is null then raise exception 'An override reason is required'; end if;
  if p_ats_result='PENDING' then raise exception 'An override cannot be pending'; end if;
  if (p_home_score is not null and p_home_score<0) or (p_away_score is not null and p_away_score<0) then raise exception 'Scores cannot be negative'; end if;
  v_before:=jsonb_build_object('home_score',v_game.home_score,'away_score',v_game.away_score,'score_override',v_game.score_override,'result',(select ats_result from public.game_results where game_id=p_game_id));
  update public.games set home_score=p_home_score,away_score=p_away_score,status=case when p_ats_result='VOID' then status else 'FINAL' end,score_override=true,updated_at=now() where id=p_game_id;
  insert into public.game_results(game_id,ats_result,calculated_from_score,override,override_reason,updated_by,updated_at)
  values(p_game_id,p_ats_result,false,true,p_reason,auth.uid(),now())
  on conflict(game_id) do update set ats_result=excluded.ats_result,calculated_from_score=false,override=true,override_reason=p_reason,updated_by=auth.uid(),updated_at=now();
  update public.picks set result=case when p_ats_result='PUSH' then 'PUSH'::public.pick_result when p_ats_result='VOID' then 'VOID'::public.pick_result when selected_side::text=p_ats_result::text then 'CORRECT'::public.pick_result else 'INCORRECT'::public.pick_result end,updated_at=now() where game_id=p_game_id;
  insert into public.audit_events(league_id,actor_user_id,entity_type,entity_id,event_type,before_json,after_json,reason)
  values(v_league_id,auth.uid(),'game',p_game_id,'GAME_RESULT_OVERRIDDEN',v_before,jsonb_build_object('home_score',p_home_score,'away_score',p_away_score,'ats_result',p_ats_result),p_reason);
end;
$$;
revoke all on function public.override_game_result(uuid,integer,integer,public.ats_result,text) from public,anon;
grant execute on function public.override_game_result(uuid,integer,integer,public.ats_result,text) to authenticated;
