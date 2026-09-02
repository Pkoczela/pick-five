alter table public.official_lines
  add column if not exists updated_at timestamptz not null default now();
