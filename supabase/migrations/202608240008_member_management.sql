create or replace function public.update_league_member(
  p_member_id uuid,
  p_role public.member_role,
  p_active boolean
) returns void language plpgsql security definer set search_path='' as $$
declare v_member public.league_members;v_before jsonb;v_owner_count integer;
begin
  select * into v_member from public.league_members where id=p_member_id for update;
  if v_member.id is null then raise exception 'Member not found'; end if;
  if not exists(select 1 from public.league_members where league_id=v_member.league_id and user_id=auth.uid() and active and role='OWNER') then raise exception 'Only the league owner can manage roles and access'; end if;
  v_before:=to_jsonb(v_member);
  if v_member.role='OWNER' and (p_role<>'OWNER' or not p_active) then
    select count(*) into v_owner_count from public.league_members where league_id=v_member.league_id and role='OWNER' and active and id<>p_member_id;
    if v_owner_count=0 then raise exception 'A league must keep at least one active owner'; end if;
  end if;
  update public.league_members set role=p_role,active=p_active where id=p_member_id;
  insert into public.audit_events(league_id,actor_user_id,entity_type,entity_id,event_type,before_json,after_json)
  values(v_member.league_id,auth.uid(),'league_member',p_member_id,'MEMBER_ACCESS_CHANGED',v_before,jsonb_build_object('role',p_role,'active',p_active));
end;
$$;
revoke all on function public.update_league_member(uuid,public.member_role,boolean) from public,anon;
grant execute on function public.update_league_member(uuid,public.member_role,boolean) to authenticated;
