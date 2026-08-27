alter table public.weeks
  add column test_lock_active boolean not null default false,
  add column test_original_lock_at timestamptz;

alter table public.weeks
  add constraint weeks_test_lock_state_check check (
    (test_lock_active and test_original_lock_at is not null)
    or (not test_lock_active and test_original_lock_at is null)
  );

create or replace function public.start_week_lock_test(p_week_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_week public.weeks%rowtype;
  v_league_id uuid;
  v_entry_count integer;
begin
  select * into v_week from public.weeks where id = p_week_id for update;
  if v_week.id is null then raise exception 'Week not found'; end if;

  v_league_id := public.week_league_id(p_week_id);
  if not public.is_league_admin(v_league_id) then raise exception 'Commissioner access required'; end if;
  if v_week.status <> 'OPEN' then raise exception 'Only an open week can start a locked-board test'; end if;
  if v_week.test_lock_active then raise exception 'A locked-board test is already active'; end if;
  if v_week.lock_at is null or now() >= v_week.lock_at then raise exception 'The scheduled deadline has already passed'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'A test reason is required'; end if;
  if exists (
    select 1 from public.games
    where week_id = p_week_id
      and (kickoff_at <= now() or status in ('IN_PROGRESS', 'FINAL', 'CANCELED'))
  ) then raise exception 'Locked-board testing is only available before every game has started'; end if;

  select count(*) into v_entry_count
  from public.entries
  where week_id = p_week_id and status = 'SUBMITTED';
  if v_entry_count < 2 then raise exception 'At least two submitted entries are required to test the shared pool board'; end if;

  update public.weeks
  set status = 'LOCKED',
      test_lock_active = true,
      test_original_lock_at = lock_at,
      lock_at = now(),
      updated_at = now()
  where id = p_week_id;

  update public.entries
  set status = 'LOCKED', last_edited_at = now()
  where week_id = p_week_id and status = 'SUBMITTED';

  insert into public.audit_events(
    league_id, actor_user_id, entity_type, entity_id, event_type,
    before_json, after_json, reason
  ) values (
    v_league_id, auth.uid(), 'week', p_week_id, 'WEEK_LOCK_TEST_STARTED',
    jsonb_build_object('status', v_week.status, 'lock_at', v_week.lock_at),
    jsonb_build_object('status', 'LOCKED', 'test_lock_active', true, 'submitted_entries', v_entry_count),
    trim(p_reason)
  );
end;
$$;

grant execute on function public.start_week_lock_test(uuid, text) to authenticated;

create or replace function public.end_week_lock_test(p_week_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_week public.weeks%rowtype;
  v_league_id uuid;
begin
  select * into v_week from public.weeks where id = p_week_id for update;
  if v_week.id is null then raise exception 'Week not found'; end if;

  v_league_id := public.week_league_id(p_week_id);
  if not public.is_league_admin(v_league_id) then raise exception 'Commissioner access required'; end if;
  if not v_week.test_lock_active or v_week.test_original_lock_at is null then raise exception 'No locked-board test is active'; end if;
  if v_week.status <> 'LOCKED' then raise exception 'The test week is no longer in a reversible locked state'; end if;
  if now() >= v_week.test_original_lock_at then raise exception 'The real submission deadline has passed; entries cannot be reopened'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'A reason is required to end the test'; end if;
  if exists (
    select 1 from public.games
    where week_id = p_week_id
      and (kickoff_at <= now() or status in ('IN_PROGRESS', 'FINAL', 'CANCELED'))
  ) then raise exception 'Entries cannot be reopened after a game has started'; end if;

  update public.weeks
  set status = 'OPEN',
      lock_at = test_original_lock_at,
      test_lock_active = false,
      test_original_lock_at = null,
      updated_at = now()
  where id = p_week_id;

  update public.entries
  set status = 'SUBMITTED', last_edited_at = now()
  where week_id = p_week_id and status = 'LOCKED';

  insert into public.audit_events(
    league_id, actor_user_id, entity_type, entity_id, event_type,
    before_json, after_json, reason
  ) values (
    v_league_id, auth.uid(), 'week', p_week_id, 'WEEK_LOCK_TEST_ENDED',
    jsonb_build_object('status', v_week.status, 'test_lock_active', true),
    jsonb_build_object('status', 'OPEN', 'lock_at', v_week.test_original_lock_at),
    trim(p_reason)
  );
end;
$$;

grant execute on function public.end_week_lock_test(uuid, text) to authenticated;
