alter table public.weeks add column if not exists reconciliation_order integer;
alter table public.weeks add column if not exists reopened_reason text;

create or replace function public.finalize_week_manual(
  p_week_id uuid,
  p_allocations jsonb,
  p_note text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_week public.weeks;
  v_league_id uuid;
  v_calculated integer;
  v_contribution integer;
  v_jackpot integer;
  v_total integer;
  v_count integer;
  v_resolution public.resolution_type;
begin
  select * into v_week from public.weeks where id=p_week_id for update;
  if v_week.id is null then raise exception 'Week not found'; end if;
  v_league_id:=public.week_league_id(p_week_id);
  if not public.is_league_admin(v_league_id) then raise exception 'Not authorized'; end if;
  if v_week.status<>'TIE_REQUIRES_COMMISSIONER' then raise exception 'Week does not require manual tie resolution'; end if;
  if nullif(trim(p_note),'') is null then raise exception 'A resolution note is required'; end if;
  if jsonb_typeof(p_allocations)<>'array' or jsonb_array_length(p_allocations)=0 then raise exception 'At least one payout allocation is required'; end if;

  select count(*),coalesce(sum(x.amount_cents),0) into v_count,v_total
  from jsonb_to_recordset(p_allocations) as x(member_id uuid,amount_cents integer)
  join public.weekly_player_results r on r.week_id=p_week_id and r.league_member_id=x.member_id and r.is_five_and_zero
  where x.amount_cents>=0;
  if v_count<>jsonb_array_length(p_allocations) then raise exception 'Allocations must belong to tied 5-0 players'; end if;
  if (select count(distinct x.member_id) from jsonb_to_recordset(p_allocations) as x(member_id uuid,amount_cents integer))<>v_count then raise exception 'Duplicate payout member'; end if;

  select count(*)*v_week.default_entry_fee_cents into v_calculated from public.entries where week_id=p_week_id and status in('SUBMITTED','LOCKED');
  v_contribution:=coalesce(v_week.contribution_override_cents,v_calculated);
  v_jackpot:=v_week.rollover_in_cents+v_contribution;
  if v_total<>v_jackpot then raise exception 'Payout allocations must equal the available jackpot'; end if;
  v_resolution:=case when v_count>1 then 'SPLIT' else 'MANUAL' end;

  delete from public.payout_allocations where week_id=p_week_id;
  update public.weekly_player_results set is_winner=false,winnings_cents=0 where week_id=p_week_id;
  insert into public.weekly_financials(week_id,rollover_in_cents,calculated_contribution_cents,contribution_override_cents,final_contribution_cents,payout_cents,rollover_out_cents,resolution_type,resolution_note,finalized_at,finalized_by)
  values(p_week_id,v_week.rollover_in_cents,v_calculated,v_week.contribution_override_cents,v_contribution,v_jackpot,0,v_resolution,p_note,now(),auth.uid())
  on conflict(week_id) do update set calculated_contribution_cents=excluded.calculated_contribution_cents,contribution_override_cents=excluded.contribution_override_cents,final_contribution_cents=excluded.final_contribution_cents,payout_cents=excluded.payout_cents,rollover_out_cents=0,resolution_type=excluded.resolution_type,resolution_note=excluded.resolution_note,finalized_at=now(),finalized_by=auth.uid(),revision=public.weekly_financials.revision+1;
  insert into public.payout_allocations(week_id,league_member_id,amount_cents)
  select p_week_id,x.member_id,x.amount_cents from jsonb_to_recordset(p_allocations) as x(member_id uuid,amount_cents integer);
  update public.weekly_player_results r set is_winner=true,winnings_cents=x.amount_cents
  from jsonb_to_recordset(p_allocations) as x(member_id uuid,amount_cents integer)
  where r.week_id=p_week_id and r.league_member_id=x.member_id;
  update public.weeks set status='FINAL',payout_cents=v_jackpot,rollover_out_cents=0,finalized_at=now(),finalized_by=auth.uid(),updated_at=now() where id=p_week_id;
  insert into public.audit_events(league_id,actor_user_id,entity_type,entity_id,event_type,after_json,reason)
  values(v_league_id,auth.uid(),'week',p_week_id,'WINNER_MANUALLY_RESOLVED',p_allocations,p_note);
  return jsonb_build_object('type',v_resolution,'payout_cents',v_jackpot);
end;
$$;
revoke all on function public.finalize_week_manual(uuid,jsonb,text) from public,anon;
grant execute on function public.finalize_week_manual(uuid,jsonb,text) to authenticated;

create or replace function public.reopen_week_cascade(p_week_id uuid,p_reason text)
returns integer language plpgsql security definer set search_path='' as $$
declare v_week public.weeks;v_league_id uuid;v_count integer;
begin
  select * into v_week from public.weeks where id=p_week_id for update;
  if v_week.status<>'FINAL' then raise exception 'Only a final week can be reopened'; end if;
  v_league_id:=public.week_league_id(p_week_id);
  if not public.is_league_admin(v_league_id) then raise exception 'Not authorized'; end if;
  if nullif(trim(p_reason),'') is null then raise exception 'A reopen reason is required'; end if;
  update public.weeks set status='REOPENED',reopened_reason=p_reason,reconciliation_order=nfl_week-v_week.nfl_week+1,updated_at=now()
  where season_id=v_week.season_id and nfl_week>=v_week.nfl_week and status='FINAL';
  get diagnostics v_count=row_count;
  insert into public.audit_events(league_id,actor_user_id,entity_type,entity_id,event_type,before_json,after_json,reason)
  values(v_league_id,auth.uid(),'week',p_week_id,'WEEK_REOPENED',jsonb_build_object('downstream_weeks',v_count),jsonb_build_object('cascade_count',v_count),p_reason);
  return v_count;
end;
$$;
revoke all on function public.reopen_week_cascade(uuid,text) from public,anon;
grant execute on function public.reopen_week_cascade(uuid,text) to authenticated;

create or replace function public.sync_reopened_rollover(p_week_id uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare v_week public.weeks;v_rollover integer;
begin
  select * into v_week from public.weeks where id=p_week_id for update;
  if v_week.status<>'REOPENED' then return v_week.rollover_in_cents; end if;
  if not public.is_league_admin(public.week_league_id(p_week_id)) then raise exception 'Not authorized'; end if;
  if exists(select 1 from public.weeks where season_id=v_week.season_id and nfl_week<v_week.nfl_week and status='REOPENED') then raise exception 'Re-finalize earlier reopened weeks first'; end if;
  select rollover_out_cents into v_rollover from public.weeks where season_id=v_week.season_id and nfl_week<v_week.nfl_week and status='FINAL' order by nfl_week desc limit 1;
  update public.weeks set rollover_in_cents=coalesce(v_rollover,0) where id=p_week_id;
  return coalesce(v_rollover,0);
end;
$$;
revoke all on function public.sync_reopened_rollover(uuid) from public,anon;
grant execute on function public.sync_reopened_rollover(uuid) to authenticated;
