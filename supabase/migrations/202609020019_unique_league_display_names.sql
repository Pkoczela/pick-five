update public.league_members set display_name=btrim(display_name)
where display_name<>btrim(display_name);

create unique index league_members_display_name_unique
on public.league_members(league_id,lower(btrim(display_name)));

create or replace function public.update_league_display_name(
  p_member_id uuid,
  p_display_name text
) returns void language plpgsql security definer set search_path='' as $$
declare
  v_member public.league_members%rowtype;
  v_name text:=btrim(p_display_name);
  v_is_owner boolean;
begin
  select * into v_member from public.league_members where id=p_member_id for update;
  if v_member.id is null then raise exception 'Member not found'; end if;
  select exists(
    select 1 from public.league_members
    where league_id=v_member.league_id and user_id=auth.uid() and active and role='OWNER'
  ) into v_is_owner;
  if v_member.user_id is distinct from auth.uid() and not v_is_owner then raise exception 'You can only change your own display name'; end if;
  if v_member.user_id=auth.uid() and not v_member.active then raise exception 'Your league membership is inactive'; end if;
  if char_length(v_name) not between 2 and 40 then raise exception 'Display name must be 2–40 characters'; end if;
  if exists(
    select 1 from public.league_members
    where league_id=v_member.league_id and id<>p_member_id and lower(btrim(display_name))=lower(v_name)
  ) then raise exception 'That display name is already in use in this league'; end if;
  if v_member.display_name=v_name then return; end if;

  update public.league_members set display_name=v_name where id=p_member_id;
  insert into public.audit_events(league_id,actor_user_id,entity_type,entity_id,event_type,before_json,after_json,reason)
  values(v_member.league_id,auth.uid(),'league_member',p_member_id,'MEMBER_DISPLAY_NAME_CHANGED',
    jsonb_build_object('display_name',v_member.display_name),jsonb_build_object('display_name',v_name),
    case when v_member.user_id=auth.uid() then 'Member changed their display name' else 'League owner changed member display name' end);
end;
$$;

revoke all on function public.update_league_display_name(uuid,text) from public,anon;
grant execute on function public.update_league_display_name(uuid,text) to authenticated;
