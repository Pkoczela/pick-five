create extension if not exists pgcrypto;
create extension if not exists citext;

create type public.member_role as enum ('OWNER', 'COMMISSIONER', 'PLAYER');
create type public.season_status as enum ('UPCOMING', 'ACTIVE', 'COMPLETE');
create type public.week_status as enum ('DRAFT', 'OPEN', 'LOCKED', 'AWAITING_FINAL', 'TIE_REQUIRES_COMMISSIONER', 'FINAL', 'REOPENED');
create type public.game_status as enum ('SCHEDULED', 'IN_PROGRESS', 'FINAL', 'POSTPONED', 'CANCELED');
create type public.ats_result as enum ('HOME', 'AWAY', 'PUSH', 'PENDING', 'VOID');
create type public.entry_status as enum ('DRAFT', 'SUBMITTED', 'LOCKED', 'VOID');
create type public.pick_side as enum ('HOME', 'AWAY');
create type public.pick_result as enum ('PENDING', 'CORRECT', 'INCORRECT', 'PUSH', 'VOID');
create type public.payment_status as enum ('UNPAID', 'PAID', 'WAIVED', 'PARTIAL');
create type public.resolution_type as enum ('SOLE_WINNER', 'TIEBREAKER_WINNER', 'NO_WINNER', 'MANUAL', 'SPLIT');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username citext not null unique check (username::text ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null check (char_length(display_name) between 2 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 60),
  slug citext not null unique,
  timezone text not null default 'America/New_York',
  default_entry_fee_cents integer not null default 0 check (default_entry_fee_cents >= 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.league_invites (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  code_hash text not null unique check (char_length(code_hash) = 64),
  code_hint text not null check (char_length(code_hint) = 4),
  active boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  disabled_at timestamptz
);
create unique index one_active_invite_per_league on public.league_invites(league_id) where active;

create table public.league_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid references auth.users(id) on delete restrict,
  display_name text not null check (char_length(display_name) between 2 and 40),
  role public.member_role not null default 'PLAYER',
  active boolean not null default true,
  joined_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index league_members_linked_user_unique on public.league_members(league_id, user_id) where user_id is not null;

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  year integer not null check (year between 2000 and 2200),
  name text,
  status public.season_status not null default 'UPCOMING',
  created_at timestamptz not null default now(),
  unique (league_id, year)
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  espn_team_id text unique,
  abbreviation text not null unique check (char_length(abbreviation) between 2 and 4),
  location text not null,
  name text not null,
  display_name text not null,
  logo_url text,
  active boolean not null default true
);

create table public.weeks (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  nfl_week integer not null check (nfl_week between 1 and 22),
  season_type integer not null default 2 check (season_type between 1 and 3),
  status public.week_status not null default 'DRAFT',
  lock_at timestamptz,
  tiebreaker_game_id uuid,
  default_entry_fee_cents integer not null default 0 check (default_entry_fee_cents >= 0),
  unpaid_entries_eligible boolean not null default true,
  contribution_override_cents integer check (contribution_override_cents >= 0),
  rollover_in_cents integer not null default 0 check (rollover_in_cents >= 0),
  payout_cents integer not null default 0 check (payout_cents >= 0),
  rollover_out_cents integer not null default 0 check (rollover_out_cents >= 0),
  finalized_at timestamptz,
  finalized_by uuid references auth.users(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, nfl_week, season_type)
);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.weeks(id) on delete cascade,
  external_source text not null default 'ESPN',
  external_event_id text,
  home_team_id uuid not null references public.teams(id),
  away_team_id uuid not null references public.teams(id),
  kickoff_at timestamptz not null,
  status public.game_status not null default 'SCHEDULED',
  home_score integer check (home_score >= 0),
  away_score integer check (away_score >= 0),
  is_selectable boolean not null default true,
  disabled_reason text,
  last_synced_at timestamptz,
  score_override boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (home_team_id <> away_team_id),
  unique (external_source, external_event_id)
);

alter table public.weeks add constraint weeks_tiebreaker_game_fk foreign key (tiebreaker_game_id) references public.games(id);

create table public.official_lines (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  revision integer not null,
  home_spread numeric(4,1) not null check (home_spread * 2 = trunc(home_spread * 2)),
  source text not null default 'MANUAL',
  source_bookmaker text,
  source_timestamp timestamptz,
  published_at timestamptz,
  is_current boolean not null default true,
  override_reason text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (game_id, revision)
);
create unique index official_lines_one_current on public.official_lines(game_id) where is_current;

create table public.game_results (
  game_id uuid primary key references public.games(id) on delete cascade,
  ats_result public.ats_result not null default 'PENDING',
  calculated_from_score boolean not null default false,
  override boolean not null default false,
  override_reason text,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.weeks(id) on delete cascade,
  league_member_id uuid not null references public.league_members(id) on delete restrict,
  status public.entry_status not null default 'DRAFT',
  tiebreaker_points integer check (tiebreaker_points between 0 and 200),
  submitted_at timestamptz,
  last_edited_at timestamptz not null default now(),
  commissioner_edited boolean not null default false,
  commissioner_edit_reason text,
  created_at timestamptz not null default now(),
  unique (week_id, league_member_id)
);

create table public.picks (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete restrict,
  selected_side public.pick_side not null,
  selected_team_id uuid not null references public.teams(id),
  submitted_official_line_id uuid not null references public.official_lines(id),
  result public.pick_result not null default 'PENDING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entry_id, game_id)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.weeks(id) on delete cascade,
  league_member_id uuid not null references public.league_members(id) on delete restrict,
  expected_cents integer not null check (expected_cents >= 0),
  received_cents integer not null default 0 check (received_cents >= 0),
  status public.payment_status not null default 'UNPAID',
  paid_at timestamptz,
  note text,
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (week_id, league_member_id)
);

create table public.weekly_player_results (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.weeks(id) on delete restrict,
  league_member_id uuid not null references public.league_members(id) on delete restrict,
  entry_id uuid not null references public.entries(id) on delete restrict,
  correct_count integer not null check (correct_count between 0 and 5),
  push_count integer not null check (push_count between 0 and 5),
  incorrect_count integer not null check (incorrect_count between 0 and 5),
  void_count integer not null default 0 check (void_count between 0 and 5),
  tiebreaker_prediction integer not null,
  tiebreaker_actual integer,
  tiebreaker_error integer,
  is_five_and_zero boolean not null,
  is_winner boolean not null default false,
  winnings_cents integer not null default 0 check (winnings_cents >= 0),
  finalized_at timestamptz not null,
  unique (week_id, league_member_id)
);

create table public.weekly_financials (
  week_id uuid primary key references public.weeks(id) on delete restrict,
  rollover_in_cents integer not null check (rollover_in_cents >= 0),
  calculated_contribution_cents integer not null check (calculated_contribution_cents >= 0),
  contribution_override_cents integer check (contribution_override_cents >= 0),
  final_contribution_cents integer not null check (final_contribution_cents >= 0),
  payout_cents integer not null check (payout_cents >= 0),
  rollover_out_cents integer not null check (rollover_out_cents >= 0),
  resolution_type public.resolution_type not null,
  resolution_note text,
  revision integer not null default 1,
  finalized_at timestamptz not null,
  finalized_by uuid not null references auth.users(id)
);

create table public.payout_allocations (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.weekly_financials(week_id) on delete restrict,
  league_member_id uuid not null references public.league_members(id) on delete restrict,
  amount_cents integer not null check (amount_cents >= 0),
  unique (week_id, league_member_id)
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete restrict,
  actor_user_id uuid references auth.users(id),
  entity_type text not null,
  entity_id uuid,
  event_type text not null,
  before_json jsonb,
  after_json jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index seasons_league_status_idx on public.seasons(league_id, status);
create index weeks_season_status_idx on public.weeks(season_id, status);
create index games_week_kickoff_idx on public.games(week_id, kickoff_at);
create index entries_week_member_idx on public.entries(week_id, league_member_id);
create index picks_entry_idx on public.picks(entry_id);
create index payments_week_idx on public.payments(week_id);
create index audit_league_created_idx on public.audit_events(league_id, created_at desc);

create or replace function public.handle_new_user_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, username, display_name)
  values (
    new.id,
    lower(coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1))),
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user_profile();

create or replace function public.create_owned_league(
  p_user_id uuid,
  p_name text,
  p_slug text,
  p_invite_code_hash text,
  p_invite_code_hint text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_league_id uuid;
  v_display_name text;
begin
  select display_name into v_display_name from public.profiles where id = p_user_id;
  if v_display_name is null then raise exception 'Profile missing'; end if;

  insert into public.leagues(name, slug, created_by)
  values (p_name, p_slug, p_user_id) returning id into v_league_id;
  insert into public.league_members(league_id, user_id, display_name, role, joined_at)
  values (v_league_id, p_user_id, v_display_name, 'OWNER', now());
  insert into public.league_invites(league_id, code_hash, code_hint, created_by)
  values (v_league_id, p_invite_code_hash, p_invite_code_hint, p_user_id);
  return v_league_id;
end;
$$;
revoke all on function public.create_owned_league(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_owned_league(uuid, text, text, text, text) to service_role;

create or replace function public.is_league_member(p_league_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(
    select 1 from public.league_members
    where league_id = p_league_id and user_id = auth.uid() and active
  );
$$;

create or replace function public.is_league_admin(p_league_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(
    select 1 from public.league_members
    where league_id = p_league_id and user_id = auth.uid() and active and role in ('OWNER', 'COMMISSIONER')
  );
$$;

create or replace function public.week_league_id(p_week_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select s.league_id from public.weeks w join public.seasons s on s.id = w.season_id where w.id = p_week_id;
$$;

alter table public.profiles enable row level security;
alter table public.leagues enable row level security;
alter table public.league_invites enable row level security;
alter table public.league_members enable row level security;
alter table public.seasons enable row level security;
alter table public.teams enable row level security;
alter table public.weeks enable row level security;
alter table public.games enable row level security;
alter table public.official_lines enable row level security;
alter table public.game_results enable row level security;
alter table public.entries enable row level security;
alter table public.picks enable row level security;
alter table public.payments enable row level security;
alter table public.weekly_player_results enable row level security;
alter table public.weekly_financials enable row level security;
alter table public.payout_allocations enable row level security;
alter table public.audit_events enable row level security;

create policy profiles_read_self on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_update_self on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy teams_read_authenticated on public.teams for select to authenticated using (true);

create policy leagues_read_member on public.leagues for select to authenticated using (public.is_league_member(id));
create policy leagues_update_admin on public.leagues for update to authenticated using (public.is_league_admin(id)) with check (public.is_league_admin(id));
create policy invites_admin_all on public.league_invites for all to authenticated using (public.is_league_admin(league_id)) with check (public.is_league_admin(league_id));
create policy members_read_league on public.league_members for select to authenticated using (public.is_league_member(league_id));
create policy members_admin_write on public.league_members for all to authenticated using (public.is_league_admin(league_id)) with check (public.is_league_admin(league_id));
create policy seasons_read_member on public.seasons for select to authenticated using (public.is_league_member(league_id));
create policy seasons_admin_write on public.seasons for all to authenticated using (public.is_league_admin(league_id)) with check (public.is_league_admin(league_id));

create policy weeks_read_member on public.weeks for select to authenticated using (public.is_league_member(public.week_league_id(id)));
create policy weeks_admin_write on public.weeks for all to authenticated using (public.is_league_admin(public.week_league_id(id))) with check (public.is_league_admin(public.week_league_id(id)));
create policy games_read_member on public.games for select to authenticated using (public.is_league_member(public.week_league_id(week_id)));
create policy games_admin_write on public.games for all to authenticated using (public.is_league_admin(public.week_league_id(week_id))) with check (public.is_league_admin(public.week_league_id(week_id)));
create policy lines_read_member on public.official_lines for select to authenticated using (
  public.is_league_member(public.week_league_id((select week_id from public.games where id = game_id)))
);
create policy lines_admin_write on public.official_lines for all to authenticated using (
  public.is_league_admin(public.week_league_id((select week_id from public.games where id = game_id)))
) with check (
  public.is_league_admin(public.week_league_id((select week_id from public.games where id = game_id)))
);
create policy results_read_member on public.game_results for select to authenticated using (
  public.is_league_member(public.week_league_id((select week_id from public.games where id = game_id)))
);
create policy results_admin_write on public.game_results for all to authenticated using (
  public.is_league_admin(public.week_league_id((select week_id from public.games where id = game_id)))
) with check (
  public.is_league_admin(public.week_league_id((select week_id from public.games where id = game_id)))
);

create policy entries_read_privacy on public.entries for select to authenticated using (
  public.is_league_member(public.week_league_id(week_id)) and (
    league_member_id = (select id from public.league_members where league_id = public.week_league_id(week_id) and user_id = auth.uid() and active limit 1)
    or public.is_league_admin(public.week_league_id(week_id))
    or exists(select 1 from public.weeks w where w.id = week_id and w.status <> 'DRAFT' and (w.status <> 'OPEN' or now() >= w.lock_at))
  )
);
create policy entries_admin_write on public.entries for all to authenticated using (public.is_league_admin(public.week_league_id(week_id))) with check (public.is_league_admin(public.week_league_id(week_id)));
create policy picks_read_privacy on public.picks for select to authenticated using (
  exists(
    select 1 from public.entries e
    where e.id = entry_id and public.is_league_member(public.week_league_id(e.week_id)) and (
      e.league_member_id = (select id from public.league_members where league_id = public.week_league_id(e.week_id) and user_id = auth.uid() and active limit 1)
      or public.is_league_admin(public.week_league_id(e.week_id))
      or exists(select 1 from public.weeks w where w.id = e.week_id and w.status <> 'DRAFT' and (w.status <> 'OPEN' or now() >= w.lock_at))
    )
  )
);

create policy payments_read_self_or_admin on public.payments for select to authenticated using (
  league_member_id = (select id from public.league_members where league_id = public.week_league_id(week_id) and user_id = auth.uid() and active limit 1)
  or public.is_league_admin(public.week_league_id(week_id))
);
create policy payments_admin_write on public.payments for all to authenticated using (public.is_league_admin(public.week_league_id(week_id))) with check (public.is_league_admin(public.week_league_id(week_id)));
create policy player_results_read_member on public.weekly_player_results for select to authenticated using (public.is_league_member(public.week_league_id(week_id)));
create policy financials_read_member on public.weekly_financials for select to authenticated using (public.is_league_member(public.week_league_id(week_id)));
create policy allocations_read_member on public.payout_allocations for select to authenticated using (public.is_league_member(public.week_league_id(week_id)));
create policy audit_read_admin on public.audit_events for select to authenticated using (public.is_league_admin(league_id));

grant usage on schema public to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, update on public.leagues to authenticated;
grant select, insert, update on public.league_invites to authenticated;
grant select, insert, update on public.league_members to authenticated;
grant select, insert, update on public.seasons to authenticated;
grant select on public.teams to authenticated;
grant select, insert, update on public.weeks, public.games, public.official_lines, public.game_results, public.entries, public.payments to authenticated;
grant select on public.picks, public.weekly_player_results, public.weekly_financials, public.payout_allocations, public.audit_events to authenticated;
