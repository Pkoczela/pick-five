alter table public.weeks add column test_snapshot jsonb;

create or replace function public.start_week_lock_test(p_week_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_week public.weeks%rowtype;
  v_league_id uuid;
  v_entry_count integer;
  v_snapshot jsonb;
begin
  select * into v_week from public.weeks where id = p_week_id for update;
  if v_week.id is null then raise exception 'Week not found'; end if;
  v_league_id := public.week_league_id(p_week_id);
  if not public.is_league_admin(v_league_id) then raise exception 'Commissioner access required'; end if;
  if v_week.status <> 'OPEN' then raise exception 'Only an open week can start a simulation'; end if;
  if v_week.test_lock_active then raise exception 'A simulation is already active'; end if;
  if v_week.lock_at is null or now() >= v_week.lock_at then raise exception 'The scheduled deadline has already passed'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'A test reason is required'; end if;
  if exists(select 1 from public.games where week_id=p_week_id and (kickoff_at<=now() or status in('IN_PROGRESS','FINAL','CANCELED'))) then
    raise exception 'Simulation is only available before every game has started';
  end if;
  select count(*) into v_entry_count from public.entries where week_id=p_week_id and status='SUBMITTED';
  if v_entry_count < 2 then raise exception 'At least two submitted entries are required to simulate a week'; end if;

  v_snapshot := jsonb_build_object(
    'week', jsonb_build_object(
      'payout_cents',v_week.payout_cents,'rollover_out_cents',v_week.rollover_out_cents,
      'finalized_at',v_week.finalized_at,'finalized_by',v_week.finalized_by
    ),
    'games', coalesce((select jsonb_agg(jsonb_build_object(
      'id',g.id,'status',g.status,'home_score',g.home_score,'away_score',g.away_score,
      'last_synced_at',g.last_synced_at,'score_override',g.score_override
    )) from public.games g where g.week_id=p_week_id),'[]'::jsonb),
    'game_results', coalesce((select jsonb_agg(jsonb_build_object(
      'game_id',r.game_id,'ats_result',r.ats_result,'calculated_from_score',r.calculated_from_score,
      'override',r.override,'override_reason',r.override_reason,'updated_by',r.updated_by,'updated_at',r.updated_at
    )) from public.game_results r join public.games g on g.id=r.game_id where g.week_id=p_week_id),'[]'::jsonb),
    'entries', coalesce((select jsonb_agg(jsonb_build_object(
      'id',e.id,'status',e.status,'last_edited_at',e.last_edited_at
    )) from public.entries e where e.week_id=p_week_id),'[]'::jsonb),
    'picks', coalesce((select jsonb_agg(jsonb_build_object(
      'id',p.id,'result',p.result,'updated_at',p.updated_at
    )) from public.picks p join public.entries e on e.id=p.entry_id where e.week_id=p_week_id),'[]'::jsonb)
  );

  update public.weeks set status='LOCKED',test_lock_active=true,test_original_lock_at=lock_at,
    test_snapshot=v_snapshot,lock_at=now(),updated_at=now() where id=p_week_id;
  update public.entries set status='LOCKED',last_edited_at=now() where week_id=p_week_id and status='SUBMITTED';
  insert into public.audit_events(league_id,actor_user_id,entity_type,entity_id,event_type,before_json,after_json,reason)
  values(v_league_id,auth.uid(),'week',p_week_id,'WEEK_SIMULATION_STARTED',
    jsonb_build_object('status',v_week.status,'lock_at',v_week.lock_at),
    jsonb_build_object('status','LOCKED','submitted_entries',v_entry_count),trim(p_reason));
end;
$$;

create or replace function public.apply_week_simulation(p_week_id uuid, p_assignments jsonb, p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare
  v_week public.weeks%rowtype;
  v_league_id uuid;
  v_item record;
  v_count integer := 0;
  v_game_count integer;
begin
  select * into v_week from public.weeks where id=p_week_id for update;
  if v_week.id is null then raise exception 'Week not found'; end if;
  v_league_id:=public.week_league_id(p_week_id);
  if not public.is_league_admin(v_league_id) then raise exception 'Commissioner access required'; end if;
  if not v_week.test_lock_active or v_week.test_snapshot is null then raise exception 'Start a week simulation first'; end if;
  if v_week.status not in('LOCKED','AWAITING_FINAL') then raise exception 'Reset the existing simulation before applying another scenario'; end if;
  if nullif(trim(p_reason),'') is null then raise exception 'A simulation reason is required'; end if;
  if jsonb_typeof(p_assignments)<>'array' then raise exception 'Simulation assignments are invalid'; end if;
  select count(*) into v_game_count from public.games where week_id=p_week_id;

  for v_item in select * from jsonb_to_recordset(p_assignments) as x(game_id uuid,ats_result public.ats_result,home_score integer,away_score integer)
  loop
    if not exists(select 1 from public.games where id=v_item.game_id and week_id=p_week_id) then raise exception 'Simulation contains a game from another week'; end if;
    if v_item.ats_result not in('HOME','AWAY') or v_item.home_score is null or v_item.away_score is null or v_item.home_score<0 or v_item.away_score<0 then
      raise exception 'Every simulated game requires non-negative scores and a HOME or AWAY result';
    end if;
    update public.games set status='FINAL',home_score=v_item.home_score,away_score=v_item.away_score,
      score_override=true,updated_at=now() where id=v_item.game_id;
    insert into public.game_results(game_id,ats_result,calculated_from_score,override,override_reason,updated_by,updated_at)
    values(v_item.game_id,v_item.ats_result,false,true,p_reason,auth.uid(),now())
    on conflict(game_id) do update set ats_result=excluded.ats_result,calculated_from_score=false,
      override=true,override_reason=excluded.override_reason,updated_by=auth.uid(),updated_at=now();
    update public.picks set result=case when selected_side::text=v_item.ats_result::text then 'CORRECT'::public.pick_result else 'INCORRECT'::public.pick_result end,
      updated_at=now() where game_id=v_item.game_id;
    v_count:=v_count+1;
  end loop;
  if v_count<>v_game_count then raise exception 'Simulation must assign every game exactly once'; end if;
  if (select count(distinct (item->>'game_id')) from jsonb_array_elements(p_assignments) item)<>v_game_count then raise exception 'Simulation contains duplicate or missing games'; end if;
  update public.weeks set status='AWAITING_FINAL',updated_at=now() where id=p_week_id;
  insert into public.audit_events(league_id,actor_user_id,entity_type,entity_id,event_type,after_json,reason)
  values(v_league_id,auth.uid(),'week',p_week_id,'WEEK_SIMULATION_APPLIED',jsonb_build_object('games',v_count),trim(p_reason));
end;
$$;

grant execute on function public.apply_week_simulation(uuid,jsonb,text) to authenticated;

create or replace function public.reset_week_simulation(p_week_id uuid, p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare
  v_week public.weeks%rowtype;
  v_league_id uuid;
  v_snapshot jsonb;
  v_reopen boolean;
begin
  select * into v_week from public.weeks where id=p_week_id for update;
  if v_week.id is null then raise exception 'Week not found'; end if;
  v_league_id:=public.week_league_id(p_week_id);
  if not public.is_league_admin(v_league_id) then raise exception 'Commissioner access required'; end if;
  if not v_week.test_lock_active or v_week.test_snapshot is null or v_week.test_original_lock_at is null then raise exception 'No reversible simulation is active'; end if;
  if nullif(trim(p_reason),'') is null then raise exception 'A reset reason is required'; end if;
  v_snapshot:=v_week.test_snapshot;
  v_reopen:=now()<v_week.test_original_lock_at;

  delete from public.payout_allocations where week_id=p_week_id;
  delete from public.weekly_financials where week_id=p_week_id;
  delete from public.weekly_player_results where week_id=p_week_id;

  update public.games g set status=x.status,home_score=x.home_score,away_score=x.away_score,
    last_synced_at=x.last_synced_at,score_override=x.score_override,updated_at=now()
  from jsonb_to_recordset(v_snapshot->'games') as x(id uuid,status public.game_status,home_score integer,away_score integer,last_synced_at timestamptz,score_override boolean)
  where g.id=x.id and g.week_id=p_week_id;

  delete from public.game_results r using public.games g where r.game_id=g.id and g.week_id=p_week_id;
  insert into public.game_results(game_id,ats_result,calculated_from_score,override,override_reason,updated_by,updated_at)
  select x.game_id,x.ats_result,x.calculated_from_score,x.override,x.override_reason,x.updated_by,x.updated_at
  from jsonb_to_recordset(v_snapshot->'game_results') as x(game_id uuid,ats_result public.ats_result,calculated_from_score boolean,override boolean,override_reason text,updated_by uuid,updated_at timestamptz);

  update public.picks p set result=x.result,updated_at=x.updated_at
  from jsonb_to_recordset(v_snapshot->'picks') as x(id uuid,result public.pick_result,updated_at timestamptz)
  where p.id=x.id;
  update public.entries e set status=case when v_reopen then x.status else 'LOCKED'::public.entry_status end,last_edited_at=x.last_edited_at
  from jsonb_to_recordset(v_snapshot->'entries') as x(id uuid,status public.entry_status,last_edited_at timestamptz)
  where e.id=x.id and e.week_id=p_week_id;

  update public.weeks set status=case when v_reopen then 'OPEN'::public.week_status else 'LOCKED'::public.week_status end,
    lock_at=v_week.test_original_lock_at,
    payout_cents=coalesce((v_snapshot->'week'->>'payout_cents')::integer,0),
    rollover_out_cents=coalesce((v_snapshot->'week'->>'rollover_out_cents')::integer,0),
    finalized_at=(v_snapshot->'week'->>'finalized_at')::timestamptz,
    finalized_by=(v_snapshot->'week'->>'finalized_by')::uuid,
    test_lock_active=false,test_original_lock_at=null,test_snapshot=null,updated_at=now()
  where id=p_week_id;

  insert into public.audit_events(league_id,actor_user_id,entity_type,entity_id,event_type,before_json,after_json,reason)
  values(v_league_id,auth.uid(),'week',p_week_id,'WEEK_SIMULATION_RESET',
    jsonb_build_object('status',v_week.status,'was_finalized',v_week.finalized_at is not null),
    jsonb_build_object('status',case when v_reopen then 'OPEN' else 'LOCKED' end,'lock_at',v_week.test_original_lock_at),trim(p_reason));
end;
$$;

grant execute on function public.reset_week_simulation(uuid,text) to authenticated;

create or replace function public.end_week_lock_test(p_week_id uuid, p_reason text)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform public.reset_week_simulation(p_week_id,p_reason);
end;
$$;
