create or replace function public.set_week_payment(
  p_week_id uuid,
  p_member_id uuid,
  p_paid boolean,
  p_note text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_league_id uuid := public.week_league_id(p_week_id);
  v_fee integer;
  v_before public.payments;
begin
  if not public.is_league_admin(v_league_id) then raise exception 'Not authorized'; end if;
  if not exists(select 1 from public.league_members where id = p_member_id and league_id = v_league_id) then raise exception 'Member is not in this league'; end if;

  select default_entry_fee_cents into v_fee from public.weeks where id = p_week_id;
  select * into v_before from public.payments where week_id = p_week_id and league_member_id = p_member_id;

  insert into public.payments(
    week_id,
    league_member_id,
    expected_cents,
    received_cents,
    status,
    paid_at,
    note,
    updated_by,
    updated_at
  )
  values (
    p_week_id,
    p_member_id,
    v_fee,
    case when p_paid then v_fee else 0 end,
    case
      when p_paid then 'PAID'::public.payment_status
      else 'UNPAID'::public.payment_status
    end,
    case when p_paid then now() end,
    nullif(trim(p_note), ''),
    auth.uid(),
    now()
  )
  on conflict (week_id, league_member_id) do update set
    received_cents = excluded.received_cents,
    status = excluded.status,
    paid_at = excluded.paid_at,
    note = excluded.note,
    updated_by = auth.uid(),
    updated_at = now();

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
  values (
    v_league_id,
    auth.uid(),
    'payment',
    p_member_id,
    'PAYMENT_STATUS_CHANGED',
    to_jsonb(v_before),
    jsonb_build_object('paid', p_paid, 'week_id', p_week_id),
    p_note
  );
end;
$$;

revoke all on function public.set_week_payment(uuid, uuid, boolean, text) from public, anon;
grant execute on function public.set_week_payment(uuid, uuid, boolean, text) to authenticated;
