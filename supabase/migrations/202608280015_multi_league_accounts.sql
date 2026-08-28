create or replace function public.join_league_existing(
  p_invite_code_hash text,
  p_display_name text
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_user_id uuid:=auth.uid();
  v_league_id uuid;
  v_member public.league_members%rowtype;
begin
  if v_user_id is null then raise exception 'Log in to join another league'; end if;
  if char_length(trim(p_display_name)) not between 2 and 40 then raise exception 'Display name must be 2–40 characters'; end if;
  select league_id into v_league_id from public.league_invites
  where code_hash=p_invite_code_hash and active and disabled_at is null;
  if v_league_id is null then raise exception 'That league code is invalid or has been disabled'; end if;

  select * into v_member from public.league_members where league_id=v_league_id and user_id=v_user_id for update;
  if v_member.id is not null and v_member.active then raise exception 'You already belong to that league'; end if;
  if v_member.id is not null then
    update public.league_members set active=true,display_name=trim(p_display_name),role='PLAYER',joined_at=now() where id=v_member.id;
  else
    insert into public.league_members(league_id,user_id,display_name,role,active,joined_at)
    values(v_league_id,v_user_id,trim(p_display_name),'PLAYER',true,now());
  end if;
  insert into public.audit_events(league_id,actor_user_id,entity_type,entity_id,event_type,after_json)
  values(v_league_id,v_user_id,'league',v_league_id,'MEMBER_JOINED_LEAGUE',jsonb_build_object('display_name',trim(p_display_name)));
  return v_league_id;
end;
$$;

revoke all on function public.join_league_existing(text,text) from public,anon;
grant execute on function public.join_league_existing(text,text) to authenticated;

create or replace function public.create_additional_league(
  p_name text,
  p_slug text,
  p_display_name text,
  p_invite_code_hash text,
  p_invite_code_hint text
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_user_id uuid:=auth.uid();
  v_league_id uuid;
begin
  if v_user_id is null then raise exception 'Log in to create another league'; end if;
  if char_length(trim(p_name)) not between 2 and 60 then raise exception 'League name must be 2–60 characters'; end if;
  if char_length(trim(p_display_name)) not between 2 and 40 then raise exception 'Display name must be 2–40 characters'; end if;
  if p_slug !~ '^[a-z0-9-]{2,60}$' then raise exception 'League slug is invalid'; end if;
  if char_length(p_invite_code_hash)<>64 or char_length(p_invite_code_hint)<>4 then raise exception 'Invitation code is invalid'; end if;

  insert into public.leagues(name,slug,created_by) values(trim(p_name),p_slug,v_user_id) returning id into v_league_id;
  insert into public.league_members(league_id,user_id,display_name,role,joined_at)
  values(v_league_id,v_user_id,trim(p_display_name),'OWNER',now());
  insert into public.league_invites(league_id,code_hash,code_hint,created_by)
  values(v_league_id,p_invite_code_hash,p_invite_code_hint,v_user_id);
  insert into public.audit_events(league_id,actor_user_id,entity_type,entity_id,event_type,after_json)
  values(v_league_id,v_user_id,'league',v_league_id,'ADDITIONAL_LEAGUE_CREATED',jsonb_build_object('name',trim(p_name)));
  return v_league_id;
end;
$$;

revoke all on function public.create_additional_league(text,text,text,text,text) from public,anon;
grant execute on function public.create_additional_league(text,text,text,text,text) to authenticated;
