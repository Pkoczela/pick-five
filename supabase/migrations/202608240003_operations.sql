create or replace function public.initialize_week_payments()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.status = 'DRAFT' and new.status = 'OPEN' then
    insert into public.payments(week_id, league_member_id, expected_cents, received_cents, status, updated_by)
    select new.id, lm.id, new.default_entry_fee_cents, 0, 'UNPAID', auth.uid()
    from public.league_members lm
    where lm.league_id = public.week_league_id(new.id) and lm.active
    on conflict (week_id, league_member_id) do nothing;
  end if;
  return new;
end;
$$;
create trigger initialize_payments_after_publish after update of status on public.weeks
for each row execute procedure public.initialize_week_payments();

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
  insert into public.payments(week_id, league_member_id, expected_cents, received_cents, status, paid_at, note, updated_by, updated_at)
  values (p_week_id, p_member_id, v_fee, case when p_paid then v_fee else 0 end, case when p_paid then 'PAID' else 'UNPAID' end, case when p_paid then now() end, nullif(trim(p_note), ''), auth.uid(), now())
  on conflict (week_id, league_member_id) do update set
    received_cents = excluded.received_cents, status = excluded.status, paid_at = excluded.paid_at,
    note = excluded.note, updated_by = auth.uid(), updated_at = now();
  insert into public.audit_events(league_id, actor_user_id, entity_type, entity_id, event_type, before_json, after_json, reason)
  values (v_league_id, auth.uid(), 'payment', p_member_id, 'PAYMENT_STATUS_CHANGED', to_jsonb(v_before), jsonb_build_object('paid', p_paid, 'week_id', p_week_id), p_note);
end;
$$;
revoke all on function public.set_week_payment(uuid, uuid, boolean, text) from public, anon;
grant execute on function public.set_week_payment(uuid, uuid, boolean, text) to authenticated;

create or replace function public.rotate_league_invite(
  p_league_id uuid,
  p_code_hash text,
  p_code_hint text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not exists(select 1 from public.league_members where league_id = p_league_id and user_id = auth.uid() and active and role = 'OWNER') then
    raise exception 'Only the league owner can rotate the invitation code';
  end if;
  update public.league_invites set active = false, disabled_at = now() where league_id = p_league_id and active;
  insert into public.league_invites(league_id, code_hash, code_hint, active, created_by)
  values (p_league_id, p_code_hash, p_code_hint, true, auth.uid()) returning id into v_id;
  insert into public.audit_events(league_id, actor_user_id, entity_type, entity_id, event_type, after_json)
  values (p_league_id, auth.uid(), 'league_invite', v_id, 'INVITE_CODE_ROTATED', jsonb_build_object('code_hint', p_code_hint));
  return v_id;
end;
$$;
revoke all on function public.rotate_league_invite(uuid, text, text) from public, anon;
grant execute on function public.rotate_league_invite(uuid, text, text) to authenticated;

create or replace function public.disable_league_invite(p_league_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.league_members where league_id = p_league_id and user_id = auth.uid() and active and role = 'OWNER') then
    raise exception 'Only the league owner can disable invitations';
  end if;
  update public.league_invites set active = false, disabled_at = now() where league_id = p_league_id and active;
  insert into public.audit_events(league_id, actor_user_id, entity_type, event_type)
  values (p_league_id, auth.uid(), 'league_invite', 'INVITE_CODE_DISABLED');
end;
$$;
revoke all on function public.disable_league_invite(uuid) from public, anon;
grant execute on function public.disable_league_invite(uuid) to authenticated;
