-- 2026-07-16 — data-integrity half of the slow-load fix.
-- 1) dedupe weight_entries (double-submit artifacts: identical weight, same date)
-- 2) unique (user_id, date) so PostgREST upsert (on_conflict) can arbitrate
-- 3) user_goals table the app has been 404ing on since the multi-user launch

delete from public.weight_entries a
  using public.weight_entries b
  where a.user_id = b.user_id and a.date = b.date and a.id > b.id;

create unique index if not exists weight_entries_user_date_key
  on public.weight_entries (user_id, date);

create table if not exists public.user_goals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  calories double precision not null default 2500,
  protein double precision not null default 180,
  carbs double precision not null default 250,
  fat double precision not null default 80,
  updated_at timestamptz not null default now()
);

alter table public.user_goals enable row level security;

drop policy if exists "user_goals_own" on public.user_goals;
create policy "user_goals_own" on public.user_goals
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Tables created via the Management API don't inherit default privileges
-- (same gotcha as the gym tables) — grant explicitly.
grant all on table public.user_goals to authenticated;

notify pgrst, 'reload schema';
