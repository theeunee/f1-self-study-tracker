-- ITERACE · first schema (brief §7). NOT APPLIED YET: review, then run with
--   supabase db push      (or paste into the SQL editor of the development project)
-- Every table: user_id → auth.users, RLS "user_id = auth.uid()", created_at / updated_at.
-- Deleting the auth user cascades to every row (account deletion, brief §3).

create extension if not exists "pgcrypto";

-- updated_at is set by the client so undo can compare versions; this trigger only fills it when missing.
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  if new.updated_at is null then new.updated_at := now(); end if;
  return new;
end $$;

-- ───────────────────────── profiles
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  display_name text not null default '',
  timezone text not null default 'UTC',
  session_weekday smallint not null default 6 check (session_weekday between 0 and 6),
  session_time text not null default '19:00' check (session_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  colour_board text[] not null default array['#E10600','#111111','#7A3CE0','#00A86B','#F5B700','#1C64F2','#0E9FA6','#E6007E'],
  length_presets int[] not null default array[30,60,90,120],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (id = user_id)
);

-- ───────────────────────── goals
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  color text not null,
  status text not null default 'active' check (status in ('active','achieved','archived')),
  start_date date not null,
  due_date date not null,
  weekly_target_min int not null default 0 check (weekly_target_min >= 0),
  smart_s text not null default '',
  smart_m text not null default '',
  smart_a text not null default '',
  smart_r text not null default '',
  sort_order int not null default 0,
  achieved_on date,
  archived_on date,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.goal_marks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  goal_id uuid not null references public.goals on delete cascade,
  kind text not null default 'deadline_moved' check (kind in ('deadline_moved')),
  from_date date not null,
  to_date date not null,
  made_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subgoals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  goal_id uuid not null references public.goals on delete cascade,
  title text not null,
  start_date date not null,
  due_date date not null,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ───────────────────────── races
create table public.races (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  number int not null,
  starts_at timestamptz not null,
  session_at timestamptz not null,
  ended_at timestamptz,
  status text not null default 'planned' check (status in ('planned','live','in_session','done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, number)
);

create table public.race_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  race_id uuid not null references public.races on delete cascade,
  goal_id uuid not null references public.goals on delete cascade,
  target_min int not null check (target_min >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (race_id, goal_id)
);

-- ───────────────────────── laps
create table public.laps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  race_id uuid not null references public.races on delete cascade,
  goal_id uuid references public.goals on delete set null,
  title text not null,
  description text not null default '',
  planned_start timestamptz,                -- null = in Laps to place
  planned_min int not null check (planned_min > 0),
  color text,
  auto_end boolean not null default true,
  status text not null default 'planned' check (status in ('planned','done','moved','dropped')),
  source text not null default 'manual' check (source in ('manual','repeat','calendar','carried')),
  moved_from_lap_id uuid references public.laps on delete set null,
  carried_from_lap_id uuid references public.laps on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lap_times (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  lap_id uuid not null references public.laps on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,                     -- null while running
  how text not null default 'timed' check (how in ('timed','by_hand')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);
-- At most one running timer per user.
create unique index lap_times_one_running on public.lap_times (user_id) where ended_at is null;

-- ───────────────────────── repeats
create table public.repeat_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  goal_id uuid references public.goals on delete set null,
  title text not null,
  days smallint[] not null,
  start_time text not null,
  length_min int not null check (length_min > 0),
  from_date date not null,
  until_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.repeat_choices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  rule_id uuid not null references public.repeat_rules on delete cascade,
  date date not null,
  choice text not null check (choice in ('kept','skipped')),
  lap_id uuid references public.laps on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rule_id, date)
);

-- ───────────────────────── calendar
create table public.calendar_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  provider text not null default 'google' check (provider in ('google','apple','other')),
  name text not null,
  ics_url text not null,                    -- secret: never selectable by the browser (see grants below)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.calendar_choices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  source_id uuid not null references public.calendar_sources on delete cascade,
  event_uid text not null,
  date date not null,
  choice text not null check (choice in ('added','dismissed')),
  lap_id uuid references public.laps on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, event_uid, date)
);

-- ───────────────────────── countdowns, log, session
create table public.countdowns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  date date not null,
  time text,
  selected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.log_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  race_id uuid not null references public.races on delete cascade,
  page text not null check (page in ('home','week','goals','session')),
  kind text not null,
  main text not null,
  detail text not null default '',
  payload jsonb,                            -- { ops: [{table,id,before,after}] } for undo
  undone boolean not null default false,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.debriefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  race_id uuid not null references public.races on delete cascade,
  why text not null default '',
  goal_notes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (race_id)
);

create table public.briefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  race_id uuid not null references public.races on delete cascade,
  focus text not null default '',
  subgoal_focus jsonb not null default '{}'::jsonb,
  start_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (race_id)
);

create table public.carry_choices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  race_id uuid not null references public.races on delete cascade,
  lap_id uuid not null references public.laps on delete cascade,
  choice text not null check (choice in ('carry','drop')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (race_id, lap_id)
);

create table public.session_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  race_id uuid not null references public.races on delete cascade,
  debrief boolean not null default false,
  unfinished boolean not null default false,
  plan boolean not null default false,
  brief boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (race_id)
);

-- ───────────────────────── RLS + triggers on every table
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','goals','goal_marks','subgoals','races','race_targets','laps','lap_times',
    'repeat_rules','repeat_choices','calendar_sources','calendar_choices','countdowns',
    'log_entries','debriefs','briefs','carry_choices','session_checks'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own rows" on public.%I for all to authenticated
                    using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('create trigger touch before insert or update on public.%I
                    for each row execute function public.touch_updated_at()', t);
    execute format('create index on public.%I (user_id)', t);
  end loop;
end $$;

-- The browser may never read or write calendar links. Only the Edge Function (service role) touches ics_url.
revoke all on public.calendar_sources from anon, authenticated;
grant select (id, user_id, provider, name, created_at, updated_at) on public.calendar_sources to authenticated;
grant update (name, updated_at) on public.calendar_sources to authenticated;
grant delete on public.calendar_sources to authenticated;

-- Account deletion: removes the auth user, which cascades to every row above.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
