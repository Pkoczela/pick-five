-- A player who returns during a no-winner streak owes the current entry fee
-- plus each entry fee they skipped since the most recent winning week.

create or replace function public.member_week_entry_fee(
  p_week_id uuid,
  p_member_id uuid
) returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_week public.weeks;
  v_last_winner_order integer;
  v_fee bigint;
begin
  select * into v_week from public.weeks where id = p_week_id;
  if v_week.id is null then raise exception 'Week not found'; end if;
  if not exists(
    select 1 from public.league_members
    where id = p_member_id and league_id = public.week_league_id(p_week_id)
  ) then raise exception 'Member is not in this league'; end if;

  select max(w.season_type * 100 + w.nfl_week) into v_last_winner_order
  from public.weeks w
  where w.season_id = v_week.season_id
    and (w.season_type * 100 + w.nfl_week) < (v_week.season_type * 100 + v_week.nfl_week)
    and w.status = 'FINAL'
    and exists(
      select 1 from public.weekly_player_results r
      where r.week_id = w.id and r.is_winner
    );

  select v_week.default_entry_fee_cents + coalesce(sum(missed.default_entry_fee_cents), 0)
  into v_fee
  from public.weeks missed
  where missed.season_id = v_week.season_id
    and (missed.season_type * 100 + missed.nfl_week) < (v_week.season_type * 100 + v_week.nfl_week)
    and (missed.season_type * 100 + missed.nfl_week) > coalesce(v_last_winner_order, 0)
    and missed.status = 'FINAL'
    and not exists(
      select 1 from public.entries e
      where e.week_id = missed.id
        and e.league_member_id = p_member_id
        and e.status in ('SUBMITTED', 'LOCKED')
    );

  if v_fee > 2147483647 then raise exception 'Entry fee obligation exceeds supported range'; end if;
  return v_fee::integer;
end;
$$;

revoke all on function public.member_week_entry_fee(uuid, uuid) from public, anon, authenticated;

create or replace function public.sync_week_entry_payment(
  p_week_id uuid,
  p_member_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fee integer := public.member_week_entry_fee(p_week_id, p_member_id);
begin
  insert into public.payments(
    week_id, league_member_id, expected_cents, received_cents, status, updated_by
  )
  values (p_week_id, p_member_id, v_fee, 0, 'UNPAID', auth.uid())
  on conflict (week_id, league_member_id) do update set
    expected_cents = excluded.expected_cents,
    status = case
      when public.payments.status = 'WAIVED' then 'WAIVED'::public.payment_status
      when public.payments.received_cents >= excluded.expected_cents then 'PAID'::public.payment_status
      when public.payments.received_cents > 0 then 'PARTIAL'::public.payment_status
      else 'UNPAID'::public.payment_status
    end,
    paid_at = case
      when public.payments.status = 'WAIVED' then public.payments.paid_at
      when public.payments.received_cents >= excluded.expected_cents then coalesce(public.payments.paid_at, now())
      else null
    end,
    updated_at = now();
end;
$$;

revoke all on function public.sync_week_entry_payment(uuid, uuid) from public, anon, authenticated;

create or replace function public.sync_submitted_entry_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('SUBMITTED', 'LOCKED') then
    perform public.sync_week_entry_payment(new.week_id, new.league_member_id);
  end if;
  return new;
end;
$$;

drop trigger if exists sync_payment_after_entry_submission on public.entries;
create trigger sync_payment_after_entry_submission
after insert or update of status on public.entries
for each row execute procedure public.sync_submitted_entry_payment();

create or replace function public.initialize_week_payments()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'DRAFT' and new.status = 'OPEN' then
    insert into public.payments(week_id, league_member_id, expected_cents, received_cents, status, updated_by)
    select new.id, lm.id, public.member_week_entry_fee(new.id, lm.id), 0, 'UNPAID', auth.uid()
    from public.league_members lm
    where lm.league_id = public.week_league_id(new.id) and lm.active
    on conflict (week_id, league_member_id) do update set
      expected_cents = excluded.expected_cents,
      updated_at = now();
  end if;
  return new;
end;
$$;

create or replace function public.week_calculated_contribution(p_week_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_league_id uuid := public.week_league_id(p_week_id);
  v_total bigint;
begin
  if v_league_id is null or not public.is_league_member(v_league_id) then
    raise exception 'Not authorized';
  end if;

  select coalesce(sum(public.member_week_entry_fee(e.week_id, e.league_member_id)), 0)
  into v_total
  from public.entries e
  where e.week_id = p_week_id and e.status in ('SUBMITTED', 'LOCKED');

  if v_total > 2147483647 then raise exception 'Weekly contribution exceeds supported range'; end if;
  return v_total::integer;
end;
$$;

revoke all on function public.week_calculated_contribution(uuid) from public, anon;
grant execute on function public.week_calculated_contribution(uuid) to authenticated;

create or replace function public.set_week_payment(
  p_week_id uuid,
  p_member_id uuid,
  p_paid boolean,
  p_note text default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_league_id uuid := public.week_league_id(p_week_id);
  v_fee integer;
  v_before public.payments;
begin
  if not public.is_league_admin(v_league_id) then raise exception 'Not authorized'; end if;
  if not exists(select 1 from public.league_members where id = p_member_id and league_id = v_league_id) then raise exception 'Member is not in this league'; end if;

  v_fee := public.member_week_entry_fee(p_week_id, p_member_id);
  select * into v_before from public.payments where week_id = p_week_id and league_member_id = p_member_id;

  insert into public.payments(
    week_id, league_member_id, expected_cents, received_cents, status,
    paid_at, note, updated_by, updated_at
  )
  values (
    p_week_id, p_member_id, v_fee, case when p_paid then v_fee else 0 end,
    case when p_paid then 'PAID'::public.payment_status else 'UNPAID'::public.payment_status end,
    case when p_paid then now() end, nullif(trim(p_note), ''), auth.uid(), now()
  )
  on conflict (week_id, league_member_id) do update set
    expected_cents = excluded.expected_cents,
    received_cents = excluded.received_cents,
    status = excluded.status,
    paid_at = excluded.paid_at,
    note = excluded.note,
    updated_by = auth.uid(),
    updated_at = now();

  insert into public.audit_events(
    league_id, actor_user_id, entity_type, entity_id, event_type,
    before_json, after_json, reason
  )
  values (
    v_league_id, auth.uid(), 'payment', p_member_id, 'PAYMENT_STATUS_CHANGED',
    to_jsonb(v_before), jsonb_build_object('paid', p_paid, 'week_id', p_week_id, 'expected_cents', v_fee), p_note
  );
end;
$$;

revoke all on function public.set_week_payment(uuid, uuid, boolean, text) from public, anon;
grant execute on function public.set_week_payment(uuid, uuid, boolean, text) to authenticated;

-- Recalculate an already-published week when this migration is applied mid-streak.
insert into public.payments(
  week_id, league_member_id, expected_cents, received_cents, status, updated_by
)
select
  e.week_id,
  e.league_member_id,
  public.member_week_entry_fee(e.week_id, e.league_member_id),
  0,
  'UNPAID',
  l.created_by
from public.entries e
join public.weeks w on w.id = e.week_id
join public.seasons s on s.id = w.season_id
join public.leagues l on l.id = s.league_id
where w.status not in ('DRAFT', 'FINAL')
  and e.status in ('SUBMITTED', 'LOCKED')
on conflict (week_id, league_member_id) do nothing;

update public.payments p
set
  expected_cents = public.member_week_entry_fee(p.week_id, p.league_member_id),
  status = case
    when p.status = 'WAIVED' then 'WAIVED'::public.payment_status
    when p.received_cents >= public.member_week_entry_fee(p.week_id, p.league_member_id) then 'PAID'::public.payment_status
    when p.received_cents > 0 then 'PARTIAL'::public.payment_status
    else 'UNPAID'::public.payment_status
  end,
  paid_at = case
    when p.status = 'WAIVED' then p.paid_at
    when p.received_cents >= public.member_week_entry_fee(p.week_id, p.league_member_id) then coalesce(p.paid_at, now())
    else null
  end,
  updated_at = now()
from public.weeks w
where w.id = p.week_id and w.status not in ('DRAFT', 'FINAL');

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

  perform public.sync_week_entry_payment(e.week_id, e.league_member_id)
  from public.entries e
  where e.week_id = p_week_id and e.status in ('SUBMITTED', 'LOCKED');

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

  v_calculated := public.week_calculated_contribution(p_week_id);
  v_contribution := coalesce(v_week.contribution_override_cents, v_calculated);
  v_jackpot := v_week.rollover_in_cents + v_contribution;
  v_payout := case when v_resolution='NO_WINNER' then 0 else v_jackpot end;
  v_rollover := case when v_resolution='NO_WINNER' then v_jackpot else 0 end;

  if v_winner_member is not null then
    update public.weekly_player_results set is_winner=true,winnings_cents=v_payout where week_id=p_week_id and league_member_id=v_winner_member;
  end if;
  insert into public.weekly_financials(week_id,rollover_in_cents,calculated_contribution_cents,contribution_override_cents,final_contribution_cents,payout_cents,rollover_out_cents,resolution_type,finalized_at,finalized_by)
  values(p_week_id,v_week.rollover_in_cents,v_calculated,v_week.contribution_override_cents,v_contribution,v_payout,v_rollover,v_resolution,now(),auth.uid())
  on conflict(week_id) do update set calculated_contribution_cents=excluded.calculated_contribution_cents,contribution_override_cents=excluded.contribution_override_cents,final_contribution_cents=excluded.final_contribution_cents,payout_cents=excluded.payout_cents,rollover_out_cents=excluded.rollover_out_cents,resolution_type=excluded.resolution_type,finalized_at=now(),finalized_by=auth.uid(),revision=public.weekly_financials.revision+1;
  if v_winner_member is not null then insert into public.payout_allocations(week_id,league_member_id,amount_cents) values(p_week_id,v_winner_member,v_payout); end if;
  update public.weeks set status='FINAL',payout_cents=v_payout,rollover_out_cents=v_rollover,finalized_at=now(),finalized_by=auth.uid(),updated_at=now() where id=p_week_id;
  insert into public.audit_events(league_id,actor_user_id,entity_type,entity_id,event_type,after_json)
  values(v_league_id,auth.uid(),'week',p_week_id,'WEEK_FINALIZED',jsonb_build_object('resolution',v_resolution,'calculated_contribution_cents',v_calculated,'payout_cents',v_payout,'rollover_out_cents',v_rollover));
  return jsonb_build_object('type',v_resolution,'winner_member_id',v_winner_member,'calculated_contribution_cents',v_calculated,'payout_cents',v_payout,'rollover_out_cents',v_rollover);
end;
$$;

revoke all on function public.finalize_week_auto(uuid) from public, anon;
grant execute on function public.finalize_week_auto(uuid) to authenticated;

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

  v_calculated := public.week_calculated_contribution(p_week_id);
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
  values(v_league_id,auth.uid(),'week',p_week_id,'WINNER_MANUALLY_RESOLVED',jsonb_build_object('allocations',p_allocations,'calculated_contribution_cents',v_calculated),p_note);
  return jsonb_build_object('type',v_resolution,'calculated_contribution_cents',v_calculated,'payout_cents',v_jackpot);
end;
$$;

revoke all on function public.finalize_week_manual(uuid,jsonb,text) from public,anon;
grant execute on function public.finalize_week_manual(uuid,jsonb,text) to authenticated;
