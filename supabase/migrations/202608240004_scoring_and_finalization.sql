create or replace function public.finalize_week_auto(p_week_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_week public.weeks;
  v_league_id uuid;
  v_actual integer;
  v_candidate_count integer;
  v_best_error integer;
  v_best_count integer;
  v_winner_member uuid;
  v_resolution public.resolution_type;
  v_entry_count integer;
  v_calculated integer;
  v_contribution integer;
  v_jackpot integer;
  v_payout integer;
  v_rollover integer;
begin
  select * into v_week from public.weeks where id = p_week_id for update;
  if v_week.id is null then raise exception 'Week not found'; end if;
  v_league_id := public.week_league_id(p_week_id);
  if not public.is_league_admin(v_league_id) then raise exception 'Not authorized'; end if;
  if v_week.status not in ('LOCKED', 'AWAITING_FINAL', 'TIE_REQUIRES_COMMISSIONER', 'REOPENED', 'OPEN') then raise exception 'Week is not ready for finalization'; end if;
  if v_week.lock_at is null or now() < v_week.lock_at then raise exception 'Week has not locked'; end if;
  if exists(
    select 1 from public.picks p join public.entries e on e.id = p.entry_id
    where e.week_id = p_week_id and e.status in ('SUBMITTED','LOCKED') and p.result = 'PENDING'
  ) then raise exception 'One or more selected games are still pending'; end if;
  if v_week.tiebreaker_game_id is null then raise exception 'Tiebreaker game is missing'; end if;
  select home_score + away_score into v_actual from public.games where id = v_week.tiebreaker_game_id and status = 'FINAL';

  delete from public.payout_allocations where week_id = p_week_id;
  delete from public.weekly_player_results where week_id = p_week_id;
  insert into public.weekly_player_results(
    week_id, league_member_id, entry_id, correct_count, push_count, incorrect_count, void_count,
    tiebreaker_prediction, tiebreaker_actual, tiebreaker_error, is_five_and_zero, is_winner, winnings_cents, finalized_at
  )
  select p_week_id, e.league_member_id, e.id,
    count(*) filter (where p.result = 'CORRECT'),
    count(*) filter (where p.result = 'PUSH'),
    count(*) filter (where p.result = 'INCORRECT'),
    count(*) filter (where p.result = 'VOID'),
    e.tiebreaker_points, v_actual,
    case when v_actual is null then null else abs(e.tiebreaker_points - v_actual) end,
    count(*) filter (where p.result = 'CORRECT') = 5,
    false, 0, now()
  from public.entries e join public.picks p on p.entry_id = e.id
  where e.week_id = p_week_id and e.status in ('SUBMITTED','LOCKED')
  group by e.id;

  select count(*) into v_candidate_count
  from public.weekly_player_results r
  where r.week_id = p_week_id and r.is_five_and_zero and (
    v_week.unpaid_entries_eligible or exists(
      select 1 from public.payments pay where pay.week_id = p_week_id and pay.league_member_id = r.league_member_id and pay.status in ('PAID','WAIVED')
    )
  );

  if v_candidate_count > 1 and v_actual is null then raise exception 'Tiebreaker game is not final'; end if;
  if v_candidate_count = 0 then
    v_resolution := 'NO_WINNER';
  elsif v_candidate_count = 1 then
    v_resolution := 'SOLE_WINNER';
    select r.league_member_id into v_winner_member from public.weekly_player_results r where r.week_id = p_week_id and r.is_five_and_zero and (v_week.unpaid_entries_eligible or exists(select 1 from public.payments pay where pay.week_id=p_week_id and pay.league_member_id=r.league_member_id and pay.status in ('PAID','WAIVED')));
  else
    select min(r.tiebreaker_error) into v_best_error from public.weekly_player_results r where r.week_id=p_week_id and r.is_five_and_zero and (v_week.unpaid_entries_eligible or exists(select 1 from public.payments pay where pay.week_id=p_week_id and pay.league_member_id=r.league_member_id and pay.status in ('PAID','WAIVED')));
    select count(*) into v_best_count from public.weekly_player_results r where r.week_id=p_week_id and r.is_five_and_zero and r.tiebreaker_error=v_best_error and (v_week.unpaid_entries_eligible or exists(select 1 from public.payments pay where pay.week_id=p_week_id and pay.league_member_id=r.league_member_id and pay.status in ('PAID','WAIVED')));
    if v_best_count > 1 then
      update public.weeks set status='TIE_REQUIRES_COMMISSIONER', updated_at=now() where id=p_week_id;
      return jsonb_build_object('type','TIE_REQUIRES_COMMISSIONER','error',v_best_error);
    end if;
    select r.league_member_id into v_winner_member from public.weekly_player_results r where r.week_id=p_week_id and r.is_five_and_zero and r.tiebreaker_error=v_best_error and (v_week.unpaid_entries_eligible or exists(select 1 from public.payments pay where pay.week_id=p_week_id and pay.league_member_id=r.league_member_id and pay.status in ('PAID','WAIVED'))) limit 1;
    v_resolution := 'TIEBREAKER_WINNER';
  end if;

  select count(*) into v_entry_count from public.entries where week_id=p_week_id and status in ('SUBMITTED','LOCKED');
  v_calculated := v_entry_count * v_week.default_entry_fee_cents;
  v_contribution := coalesce(v_week.contribution_override_cents, v_calculated);
  v_jackpot := v_week.rollover_in_cents + v_contribution;
  v_payout := case when v_resolution='NO_WINNER' then 0 else v_jackpot end;
  v_rollover := case when v_resolution='NO_WINNER' then v_jackpot else 0 end;

  if v_winner_member is not null then
    update public.weekly_player_results set is_winner=true, winnings_cents=v_payout where week_id=p_week_id and league_member_id=v_winner_member;
  end if;
  insert into public.weekly_financials(week_id, rollover_in_cents, calculated_contribution_cents, contribution_override_cents, final_contribution_cents, payout_cents, rollover_out_cents, resolution_type, finalized_at, finalized_by)
  values (p_week_id, v_week.rollover_in_cents, v_calculated, v_week.contribution_override_cents, v_contribution, v_payout, v_rollover, v_resolution, now(), auth.uid())
  on conflict (week_id) do update set calculated_contribution_cents=excluded.calculated_contribution_cents, contribution_override_cents=excluded.contribution_override_cents, final_contribution_cents=excluded.final_contribution_cents, payout_cents=excluded.payout_cents, rollover_out_cents=excluded.rollover_out_cents, resolution_type=excluded.resolution_type, finalized_at=now(), finalized_by=auth.uid(), revision=public.weekly_financials.revision+1;
  if v_winner_member is not null then insert into public.payout_allocations(week_id, league_member_id, amount_cents) values(p_week_id,v_winner_member,v_payout); end if;
  update public.weeks set status='FINAL', payout_cents=v_payout, rollover_out_cents=v_rollover, finalized_at=now(), finalized_by=auth.uid(), updated_at=now() where id=p_week_id;
  insert into public.audit_events(league_id,actor_user_id,entity_type,entity_id,event_type,after_json) values(v_league_id,auth.uid(),'week',p_week_id,'WEEK_FINALIZED',jsonb_build_object('resolution',v_resolution,'payout_cents',v_payout,'rollover_out_cents',v_rollover));
  return jsonb_build_object('type',v_resolution,'winner_member_id',v_winner_member,'payout_cents',v_payout,'rollover_out_cents',v_rollover);
end;
$$;
revoke all on function public.finalize_week_auto(uuid) from public, anon;
grant execute on function public.finalize_week_auto(uuid) to authenticated;

create or replace function public.copy_rollover_on_publish()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_rollover integer;
begin
  if old.status='DRAFT' and new.status='OPEN' then
    select rollover_out_cents into v_rollover from public.weeks where season_id=new.season_id and nfl_week<new.nfl_week and status='FINAL' order by nfl_week desc limit 1;
    update public.weeks set rollover_in_cents=coalesce(v_rollover,0) where id=new.id;
  end if;
  return new;
end;
$$;
create trigger copy_rollover_after_publish after update of status on public.weeks for each row execute procedure public.copy_rollover_on_publish();
