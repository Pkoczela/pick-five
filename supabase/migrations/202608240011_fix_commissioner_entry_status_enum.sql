create or replace function public.commissioner_submit_entry(
  p_week_id uuid,
  p_member_id uuid,
  p_tiebreaker_points integer,
  p_picks jsonb,
  p_reason text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_week public.weeks;
  v_league_id uuid;
  v_entry_id uuid;
  v_valid_count integer;
  v_before jsonb;
begin
  select * into v_week from public.weeks where id = p_week_id for update;
  if v_week.id is null then raise exception 'Week not found'; end if;

  v_league_id := public.week_league_id(p_week_id);
  if not public.is_league_admin(v_league_id) then raise exception 'Not authorized'; end if;
  if v_week.status in ('DRAFT', 'FINAL') then raise exception 'Entry cannot be edited in this week state'; end if;
  if not exists(select 1 from public.league_members where id = p_member_id and league_id = v_league_id and active) then raise exception 'Player is not active in this league'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'A commissioner edit reason is required'; end if;
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

  select jsonb_build_object(
    'entry', to_jsonb(e),
    'picks', (select jsonb_agg(to_jsonb(p)) from public.picks p where p.entry_id = e.id)
  )
  into v_before
  from public.entries e
  where e.week_id = p_week_id and e.league_member_id = p_member_id;

  insert into public.entries(
    week_id,
    league_member_id,
    status,
    tiebreaker_points,
    submitted_at,
    last_edited_at,
    commissioner_edited,
    commissioner_edit_reason
  )
  values (
    p_week_id,
    p_member_id,
    case
      when now() >= v_week.lock_at then 'LOCKED'::public.entry_status
      else 'SUBMITTED'::public.entry_status
    end,
    p_tiebreaker_points,
    now(),
    now(),
    true,
    p_reason
  )
  on conflict (week_id, league_member_id) do update set
    status = excluded.status,
    tiebreaker_points = excluded.tiebreaker_points,
    submitted_at = coalesce(public.entries.submitted_at, now()),
    last_edited_at = now(),
    commissioner_edited = true,
    commissioner_edit_reason = p_reason
  returning id into v_entry_id;

  delete from public.picks where entry_id = v_entry_id;
  insert into public.picks(entry_id, game_id, selected_side, selected_team_id, submitted_official_line_id)
  select
    v_entry_id,
    g.id,
    x.selected_side::public.pick_side,
    case when x.selected_side = 'HOME' then g.home_team_id else g.away_team_id end,
    l.id
  from jsonb_to_recordset(p_picks) as x(game_id uuid, selected_side text)
  join public.games g on g.id = x.game_id
  join public.official_lines l on l.game_id = g.id and l.is_current;

  insert into public.audit_events(league_id, actor_user_id, entity_type, entity_id, event_type, before_json, after_json, reason)
  values (
    v_league_id,
    auth.uid(),
    'entry',
    v_entry_id,
    'PLAYER_ENTRY_COMMISSIONER_EDITED',
    v_before,
    jsonb_build_object('week_id', p_week_id, 'member_id', p_member_id, 'tiebreaker', p_tiebreaker_points, 'picks', p_picks),
    p_reason
  );

  return v_entry_id;
end;
$$;

revoke all on function public.commissioner_submit_entry(uuid, uuid, integer, jsonb, text) from public, anon;
grant execute on function public.commissioner_submit_entry(uuid, uuid, integer, jsonb, text) to authenticated;
