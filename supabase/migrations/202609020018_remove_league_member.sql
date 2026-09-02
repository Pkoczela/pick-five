create or replace function public.remove_league_member(p_member_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare
  v_member public.league_members%rowtype;
  v_before jsonb;
begin
  select * into v_member from public.league_members where id=p_member_id for update;
  if v_member.id is null then raise exception 'Member not found'; end if;
  if not exists(
    select 1 from public.league_members
    where league_id=v_member.league_id and user_id=auth.uid() and active and role='OWNER'
  ) then raise exception 'Only the league owner can remove members'; end if;
  if v_member.user_id=auth.uid() then raise exception 'You cannot remove yourself from your own league'; end if;
  if exists(select 1 from public.entries where league_member_id=p_member_id)
    or exists(select 1 from public.payments where league_member_id=p_member_id)
    or exists(select 1 from public.weekly_player_results where league_member_id=p_member_id)
    or exists(select 1 from public.payout_allocations where league_member_id=p_member_id) then
    raise exception 'This member has pool history and cannot be deleted. Mark them inactive instead';
  end if;

  v_before:=to_jsonb(v_member);
  delete from public.league_members where id=p_member_id;
  insert into public.audit_events(league_id,actor_user_id,entity_type,entity_id,event_type,before_json,after_json,reason)
  values(v_member.league_id,auth.uid(),'league_member',p_member_id,'MEMBER_REMOVED_FROM_LEAGUE',v_before,
    jsonb_build_object('removed',true),'Owner permanently removed a member with no pool history');
end;
$$;

revoke all on function public.remove_league_member(uuid) from public,anon;
grant execute on function public.remove_league_member(uuid) to authenticated;
