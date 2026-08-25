create or replace function public.week_submission_count(p_week_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_league_id uuid := public.week_league_id(p_week_id);
  v_count integer;
begin
  if v_league_id is null or not public.is_league_member(v_league_id) then
    raise exception 'Not authorized';
  end if;

  select count(*)::integer
  into v_count
  from public.entries
  where week_id = p_week_id
    and status in ('SUBMITTED', 'LOCKED');

  return v_count;
end;
$$;

revoke all on function public.week_submission_count(uuid) from public, anon;
grant execute on function public.week_submission_count(uuid) to authenticated;
