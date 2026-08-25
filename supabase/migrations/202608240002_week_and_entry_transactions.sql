drop policy if exists weeks_admin_write on public.weeks;
create policy weeks_admin_insert on public.weeks for insert to authenticated with check (
  public.is_league_admin((select league_id from public.seasons where id = season_id))
);
create policy weeks_admin_update on public.weeks for update to authenticated using (
  public.is_league_admin(public.week_league_id(id))
) with check (public.is_league_admin(public.week_league_id(id)));

create or replace function public.publish_week(
  p_week_id uuid,
  p_tiebreaker_game_id uuid,
  p_unpaid_entries_eligible boolean
) returns timestamptz language plpgsql security definer set search_path = '' as $$
declare
  v_league_id uuid;
  v_season_id uuid;
  v_week_number integer;
  v_status public.week_status;
  v_lock_at timestamptz;
  v_game_count integer;
  v_missing_lines integer;
  v_prior_status public.week_status;
begin
  select s.league_id, w.season_id, w.nfl_week, w.status
  into v_league_id, v_season_id, v_week_number, v_status
  from public.weeks w join public.seasons s on s.id = w.season_id
  where w.id = p_week_id for update;

  if not public.is_league_admin(v_league_id) then raise exception 'Not authorized'; end if;
  if v_status <> 'DRAFT' then raise exception 'Only a draft week can be published'; end if;

  select count(*), min(kickoff_at) - interval '5 minutes'
  into v_game_count, v_lock_at
  from public.games where week_id = p_week_id and is_selectable;
  if v_game_count = 0 then raise exception 'At least one selectable game is required'; end if;
  if v_lock_at <= now() then raise exception 'The frozen lock deadline must be in the future'; end if;

  if not exists(select 1 from public.games where id = p_tiebreaker_game_id and week_id = p_week_id and is_selectable) then
    raise exception 'The tiebreaker game must be a selectable game from this week';
  end if;

  select count(*) into v_missing_lines
  from public.games g
  where g.week_id = p_week_id and g.is_selectable
    and not exists(select 1 from public.official_lines l where l.game_id = g.id and l.is_current);
  if v_missing_lines > 0 then raise exception 'Every selectable game needs an official line'; end if;

  select w.status into v_prior_status
  from public.weeks w
  where w.season_id = v_season_id and w.nfl_week < v_week_number
  order by w.nfl_week desc limit 1;
  if v_prior_status is not null and v_prior_status <> 'FINAL' then
    raise exception 'The prior week must be finalized before this week can open';
  end if;

  update public.official_lines l set published_at = now()
  from public.games g where g.week_id = p_week_id and l.game_id = g.id and l.is_current;
  update public.weeks set
    status = 'OPEN', lock_at = v_lock_at, tiebreaker_game_id = p_tiebreaker_game_id,
    unpaid_entries_eligible = p_unpaid_entries_eligible, updated_at = now()
  where id = p_week_id;
  insert into public.audit_events(league_id, actor_user_id, entity_type, entity_id, event_type, after_json)
  values (v_league_id, auth.uid(), 'week', p_week_id, 'WEEK_PUBLISHED', jsonb_build_object('lock_at', v_lock_at, 'unpaid_entries_eligible', p_unpaid_entries_eligible));
  return v_lock_at;
end;
$$;
revoke all on function public.publish_week(uuid, uuid, boolean) from public, anon;
grant execute on function public.publish_week(uuid, uuid, boolean) to authenticated;

create or replace function public.set_official_line(
  p_game_id uuid,
  p_home_spread numeric,
  p_reason text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_week_id uuid;
  v_league_id uuid;
  v_week_status public.week_status;
  v_old public.official_lines;
  v_revision integer;
  v_new_id uuid;
  v_has_entries boolean;
begin
  if p_home_spread * 2 <> trunc(p_home_spread * 2) then raise exception 'Spread must use whole or half points'; end if;
  select g.week_id, public.week_league_id(g.week_id), w.status into v_week_id, v_league_id, v_week_status
  from public.games g join public.weeks w on w.id = g.week_id where g.id = p_game_id;
  if not public.is_league_admin(v_league_id) then raise exception 'Not authorized'; end if;
  if v_week_status in ('FINAL', 'REOPENED') then raise exception 'Reopen final week before changing a line'; end if;

  select * into v_old from public.official_lines where game_id = p_game_id and is_current for update;
  select exists(select 1 from public.entries where week_id = v_week_id and status = 'SUBMITTED') into v_has_entries;
  if v_has_entries and nullif(trim(p_reason), '') is null then raise exception 'A reason is required after entries exist'; end if;

  v_revision := coalesce(v_old.revision, 0) + 1;
  update public.official_lines set is_current = false where game_id = p_game_id and is_current;
  insert into public.official_lines(game_id, revision, home_spread, source, is_current, override_reason, created_by, published_at)
  values (p_game_id, v_revision, p_home_spread, 'MANUAL', true, nullif(trim(p_reason), ''), auth.uid(), case when v_week_status = 'OPEN' then now() end)
  returning id into v_new_id;

  if v_old.id is not null and (v_week_status = 'OPEN' or v_has_entries) then
    insert into public.audit_events(league_id, actor_user_id, entity_type, entity_id, event_type, before_json, after_json, reason)
    values (v_league_id, auth.uid(), 'game', p_game_id, 'OFFICIAL_LINE_OVERRIDDEN', to_jsonb(v_old), jsonb_build_object('line_id', v_new_id, 'home_spread', p_home_spread), p_reason);
  end if;
  return v_new_id;
end;
$$;
revoke all on function public.set_official_line(uuid, numeric, text) from public, anon;
grant execute on function public.set_official_line(uuid, numeric, text) to authenticated;

create or replace function public.submit_entry(
  p_week_id uuid,
  p_tiebreaker_points integer,
  p_picks jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_week public.weeks;
  v_league_id uuid;
  v_member_id uuid;
  v_entry_id uuid;
  v_valid_count integer;
begin
  select * into v_week from public.weeks where id = p_week_id for update;
  if v_week.id is null then raise exception 'Week not found'; end if;
  v_league_id := public.week_league_id(p_week_id);
  select id into v_member_id from public.league_members where league_id = v_league_id and user_id = auth.uid() and active;
  if v_member_id is null then raise exception 'Not an active league member'; end if;
  if v_week.status <> 'OPEN' or v_week.lock_at is null or now() >= v_week.lock_at then raise exception 'Picks are locked'; end if;
  if p_tiebreaker_points < 0 or p_tiebreaker_points > 200 then raise exception 'Tiebreaker must be between 0 and 200'; end if;
  if jsonb_typeof(p_picks) <> 'array' or jsonb_array_length(p_picks) <> 5 then raise exception 'Exactly five picks are required'; end if;

  select count(*) into v_valid_count
  from (
    select distinct x.game_id
    from jsonb_to_recordset(p_picks) as x(game_id uuid, selected_side text)
    join public.games g on g.id = x.game_id and g.week_id = p_week_id and g.is_selectable
    join public.official_lines l on l.game_id = g.id and l.is_current
    where x.selected_side in ('HOME', 'AWAY')
  ) valid;
  if v_valid_count <> 5 then raise exception 'Picks must reference five unique selectable games with official lines'; end if;

  insert into public.entries(week_id, league_member_id, status, tiebreaker_points, submitted_at, last_edited_at)
  values (p_week_id, v_member_id, 'SUBMITTED', p_tiebreaker_points, now(), now())
  on conflict (week_id, league_member_id) do update set
    status = 'SUBMITTED', tiebreaker_points = excluded.tiebreaker_points,
    submitted_at = now(), last_edited_at = now(), commissioner_edited = false, commissioner_edit_reason = null
  returning id into v_entry_id;

  delete from public.picks where entry_id = v_entry_id;
  insert into public.picks(entry_id, game_id, selected_side, selected_team_id, submitted_official_line_id)
  select v_entry_id, g.id, x.selected_side::public.pick_side,
    case when x.selected_side = 'HOME' then g.home_team_id else g.away_team_id end,
    l.id
  from jsonb_to_recordset(p_picks) as x(game_id uuid, selected_side text)
  join public.games g on g.id = x.game_id
  join public.official_lines l on l.game_id = g.id and l.is_current;
  return v_entry_id;
end;
$$;
revoke all on function public.submit_entry(uuid, integer, jsonb) from public, anon;
grant execute on function public.submit_entry(uuid, integer, jsonb) to authenticated;

revoke insert, update, delete on public.entries, public.picks, public.official_lines from authenticated;
