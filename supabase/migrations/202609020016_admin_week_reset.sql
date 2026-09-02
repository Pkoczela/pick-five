create or replace function public.admin_reset_week_to_draft(
  p_week_id uuid,
  p_expected_league_id uuid,
  p_expected_entry_count integer,
  p_expected_pick_count integer,
  p_reason text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_week public.weeks%rowtype;
  v_league_id uuid;
  v_owner_id uuid;
  v_entries integer;
  v_picks integer;
  v_payments integer;
  v_player_results integer;
  v_financials integer;
begin
  select * into v_week from public.weeks where id=p_week_id for update;
  if v_week.id is null then raise exception 'Week not found'; end if;
  v_league_id:=public.week_league_id(p_week_id);
  if v_league_id<>p_expected_league_id then raise exception 'League safety check failed'; end if;
  if nullif(trim(p_reason),'') is null then raise exception 'A reset reason is required'; end if;
  select user_id into v_owner_id from public.league_members
  where league_id=v_league_id and role='OWNER' and active and user_id is not null
  order by created_at limit 1;
  if v_owner_id is null then raise exception 'Active league owner not found'; end if;

  select count(*) into v_entries from public.entries where week_id=p_week_id;
  select count(*) into v_picks from public.picks p join public.entries e on e.id=p.entry_id where e.week_id=p_week_id;
  if v_entries<>p_expected_entry_count or v_picks<>p_expected_pick_count then
    raise exception 'Week contents changed after review; reset canceled';
  end if;
  select count(*) into v_payments from public.payments where week_id=p_week_id;
  select count(*) into v_player_results from public.weekly_player_results where week_id=p_week_id;
  select count(*) into v_financials from public.weekly_financials where week_id=p_week_id;

  delete from public.payout_allocations where week_id=p_week_id;
  delete from public.weekly_player_results where week_id=p_week_id;
  delete from public.weekly_financials where week_id=p_week_id;
  delete from public.payments where week_id=p_week_id;
  delete from public.entries where week_id=p_week_id;
  delete from public.game_results r using public.games g where r.game_id=g.id and g.week_id=p_week_id;

  update public.games set status='SCHEDULED',home_score=null,away_score=null,
    score_override=false,updated_at=now() where week_id=p_week_id;
  update public.official_lines l set published_at=null,updated_at=now()
  from public.games g where g.week_id=p_week_id and l.game_id=g.id;
  update public.weeks set status='DRAFT',lock_at=null,tiebreaker_game_id=null,
    unpaid_entries_eligible=true,contribution_override_cents=null,
    rollover_in_cents=0,payout_cents=0,rollover_out_cents=0,
    finalized_at=null,finalized_by=null,reconciliation_order=null,reopened_reason=null,
    test_lock_active=false,test_original_lock_at=null,test_snapshot=null,updated_at=now()
  where id=p_week_id;

  insert into public.audit_events(league_id,actor_user_id,entity_type,entity_id,event_type,before_json,after_json,reason)
  values(v_league_id,v_owner_id,'week',p_week_id,'WEEK_RESET_TO_DRAFT',
    jsonb_build_object('status',v_week.status,'entries',v_entries,'picks',v_picks,'payments',v_payments,
      'player_results',v_player_results,'financials',v_financials,'test_lock_active',v_week.test_lock_active),
    jsonb_build_object('status','DRAFT','schedule_preserved',true,'spreads_preserved',true),trim(p_reason));

  return jsonb_build_object('week_id',p_week_id,'status','DRAFT','entries_removed',v_entries,
    'picks_removed',v_picks,'payments_removed',v_payments,'player_results_removed',v_player_results,
    'financials_removed',v_financials);
end;
$$;

revoke all on function public.admin_reset_week_to_draft(uuid,uuid,integer,integer,text) from public,anon,authenticated;
grant execute on function public.admin_reset_week_to_draft(uuid,uuid,integer,integer,text) to service_role;
