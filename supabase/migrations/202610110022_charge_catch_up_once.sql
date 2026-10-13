-- Charge each missed entry fee on a member's first subsequent entry in the
-- active no-winner rollover run. A later entry must not charge that same miss
-- again merely because the member did not enter the original missed week.

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
  v_current_order integer;
  v_last_winner_order integer;
  v_fee bigint;
begin
  select * into v_week from public.weeks where id = p_week_id;
  if v_week.id is null then raise exception 'Week not found'; end if;
  if not exists(
    select 1 from public.league_members
    where id = p_member_id and league_id = public.week_league_id(p_week_id)
  ) then raise exception 'Member is not in this league'; end if;

  v_current_order := v_week.season_type * 100 + v_week.nfl_week;

  select max(w.season_type * 100 + w.nfl_week) into v_last_winner_order
  from public.weeks w
  where w.season_id = v_week.season_id
    and (w.season_type * 100 + w.nfl_week) < v_current_order
    and w.status = 'FINAL'
    and exists(
      select 1 from public.weekly_player_results r
      where r.week_id = w.id and r.is_winner
    );

  select v_week.default_entry_fee_cents + coalesce(sum(missed.default_entry_fee_cents), 0)
  into v_fee
  from public.weeks missed
  where missed.season_id = v_week.season_id
    and (missed.season_type * 100 + missed.nfl_week) < v_current_order
    and (missed.season_type * 100 + missed.nfl_week) > coalesce(v_last_winner_order, 0)
    and missed.status = 'FINAL'
    and not exists(
      select 1 from public.entries missed_entry
      where missed_entry.week_id = missed.id
        and missed_entry.league_member_id = p_member_id
        and missed_entry.status in ('SUBMITTED', 'LOCKED')
    )
    and not exists(
      select 1
      from public.entries later_entry
      join public.weeks later_week on later_week.id = later_entry.week_id
      where later_entry.league_member_id = p_member_id
        and later_entry.status in ('SUBMITTED', 'LOCKED')
        and later_week.season_id = v_week.season_id
        and (later_week.season_type * 100 + later_week.nfl_week)
          > (missed.season_type * 100 + missed.nfl_week)
        and (later_week.season_type * 100 + later_week.nfl_week) < v_current_order
    );

  if v_fee > 2147483647 then raise exception 'Entry fee obligation exceeds supported range'; end if;
  return v_fee::integer;
end;
$$;

revoke all on function public.member_week_entry_fee(uuid, uuid) from public, anon, authenticated;

-- Recalculate all non-final payment rows. If the old bug made a commissioner
-- mark the inflated exact amount paid, reduce received_cents by the same
-- correction. Preserve genuinely partial/custom amounts for manual review.
create temporary table catch_up_payment_repairs on commit drop as
select
  p.id,
  p.week_id,
  p.league_member_id,
  p.expected_cents as old_expected_cents,
  p.received_cents as old_received_cents,
  p.status as old_status,
  public.member_week_entry_fee(p.week_id, p.league_member_id) as new_expected_cents,
  case
    when p.received_cents = p.expected_cents
      then public.member_week_entry_fee(p.week_id, p.league_member_id)
    else p.received_cents
  end as new_received_cents
from public.payments p
join public.weeks w on w.id = p.week_id
where w.status not in ('DRAFT', 'FINAL')
  and p.expected_cents <> public.member_week_entry_fee(p.week_id, p.league_member_id);

insert into public.audit_events(
  league_id,
  actor_user_id,
  entity_type,
  entity_id,
  event_type,
  before_json,
  after_json,
  reason
)
select
  public.week_league_id(r.week_id),
  null,
  'payment',
  r.id,
  'CATCH_UP_DOUBLE_CHARGE_REPAIRED',
  jsonb_build_object(
    'week_id', r.week_id,
    'league_member_id', r.league_member_id,
    'expected_cents', r.old_expected_cents,
    'received_cents', r.old_received_cents,
    'status', r.old_status
  ),
  jsonb_build_object(
    'week_id', r.week_id,
    'league_member_id', r.league_member_id,
    'expected_cents', r.new_expected_cents,
    'received_cents', r.new_received_cents,
    'status', case
      when r.new_received_cents >= r.new_expected_cents then 'PAID'
      when r.new_received_cents > 0 then 'PARTIAL'
      else 'UNPAID'
    end
  ),
  'Removed a catch-up fee that had already been assessed on an earlier entry'
from catch_up_payment_repairs r;

update public.payments p
set
  expected_cents = r.new_expected_cents,
  received_cents = r.new_received_cents,
  status = case
    when p.status = 'WAIVED' then 'WAIVED'::public.payment_status
    when r.new_received_cents >= r.new_expected_cents then 'PAID'::public.payment_status
    when r.new_received_cents > 0 then 'PARTIAL'::public.payment_status
    else 'UNPAID'::public.payment_status
  end,
  paid_at = case
    when p.status = 'WAIVED' then p.paid_at
    when r.new_received_cents >= r.new_expected_cents then coalesce(p.paid_at, now())
    else null
  end,
  updated_at = now()
from catch_up_payment_repairs r
where p.id = r.id;
