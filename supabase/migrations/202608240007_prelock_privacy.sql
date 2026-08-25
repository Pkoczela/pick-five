drop policy if exists entries_read_privacy on public.entries;
create policy entries_read_privacy on public.entries for select to authenticated using (
  public.is_league_member(public.week_league_id(week_id)) and (
    league_member_id=(select id from public.league_members where league_id=public.week_league_id(week_id) and user_id=auth.uid() and active limit 1)
    or exists(select 1 from public.weeks w where w.id=week_id and w.status<>'DRAFT' and (w.status<>'OPEN' or now()>=w.lock_at))
  )
);

drop policy if exists picks_read_privacy on public.picks;
create policy picks_read_privacy on public.picks for select to authenticated using (
  exists(
    select 1 from public.entries e where e.id=entry_id
      and public.is_league_member(public.week_league_id(e.week_id))
      and (
        e.league_member_id=(select id from public.league_members where league_id=public.week_league_id(e.week_id) and user_id=auth.uid() and active limit 1)
        or exists(select 1 from public.weeks w where w.id=e.week_id and w.status<>'DRAFT' and (w.status<>'OPEN' or now()>=w.lock_at))
      )
  )
);
