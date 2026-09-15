create or replace function public.set_official_lines_bulk(
  p_week_id uuid,
  p_lines jsonb,
  p_reason text default null
) returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_league_id uuid;
  v_week_status public.week_status;
  v_has_entries boolean;
  v_item record;
  v_old public.official_lines%rowtype;
  v_revision integer;
  v_new_id uuid;
  v_count integer;
  v_distinct_count integer;
  v_updated integer := 0;
begin
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) not between 1 and 64 then
    raise exception 'One or more spreads are required';
  end if;

  select public.week_league_id(w.id), w.status into v_league_id, v_week_status
  from public.weeks w where w.id = p_week_id for update;
  if v_league_id is null then raise exception 'Week not found'; end if;
  if not public.is_league_admin(v_league_id) then raise exception 'Not authorized'; end if;
  if v_week_status in ('FINAL', 'REOPENED') then raise exception 'Reopen final week before changing a line'; end if;

  select count(*), count(distinct x.game_id) into v_count, v_distinct_count
  from jsonb_to_recordset(p_lines) as x(game_id uuid, home_spread numeric);
  if v_count <> v_distinct_count then raise exception 'A game was submitted more than once'; end if;

  select exists(
    select 1 from public.entries where week_id = p_week_id and status in ('SUBMITTED', 'LOCKED')
  ) into v_has_entries;

  for v_item in
    select x.game_id, x.home_spread
    from jsonb_to_recordset(p_lines) as x(game_id uuid, home_spread numeric)
  loop
    if v_item.home_spread is null or v_item.home_spread * 2 <> trunc(v_item.home_spread * 2) then
      raise exception 'Spread must use whole or half points';
    end if;
    if not exists(select 1 from public.games where id = v_item.game_id and week_id = p_week_id) then
      raise exception 'A submitted game does not belong to this week';
    end if;

    select * into v_old from public.official_lines
    where game_id = v_item.game_id and is_current for update;
    if v_old.id is not null and v_old.home_spread = v_item.home_spread then continue; end if;
    if v_has_entries and nullif(trim(p_reason), '') is null then
      raise exception 'A reason is required after entries exist';
    end if;

    v_revision := coalesce(v_old.revision, 0) + 1;
    update public.official_lines set is_current = false
    where game_id = v_item.game_id and is_current;
    insert into public.official_lines(
      game_id, revision, home_spread, source, is_current, override_reason, created_by, published_at
    ) values (
      v_item.game_id, v_revision, v_item.home_spread, 'MANUAL', true,
      nullif(trim(p_reason), ''), auth.uid(), case when v_week_status = 'OPEN' then now() end
    ) returning id into v_new_id;

    if v_old.id is not null and (v_week_status = 'OPEN' or v_has_entries) then
      insert into public.audit_events(
        league_id, actor_user_id, entity_type, entity_id, event_type,
        before_json, after_json, reason
      ) values (
        v_league_id, auth.uid(), 'game', v_item.game_id, 'OFFICIAL_LINE_OVERRIDDEN',
        to_jsonb(v_old), jsonb_build_object('line_id', v_new_id, 'home_spread', v_item.home_spread), p_reason
      );
    end if;
    v_updated := v_updated + 1;
  end loop;

  return v_updated;
end;
$$;

revoke all on function public.set_official_lines_bulk(uuid,jsonb,text) from public,anon;
grant execute on function public.set_official_lines_bulk(uuid,jsonb,text) to authenticated;
