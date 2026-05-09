-- Schema and seed data for the Festival Scheduler app

-- Enable postgres UUID extension (for Supabase auth.users)
create extension if not exists "uuid-ossp";

-- Festivals table
create table if not exists public.festivals (
  id serial primary key,
  name text not null,
  year integer not null,
  location text,
  start_date date,
  end_date date
);

-- Stages belong to a festival
create table if not exists public.stages (
  id serial primary key,
  festival_id integer references festivals(id) on delete cascade,
  name text not null
);

-- Artists table with unique names
create table if not exists public.artists (
  id serial primary key,
  name text not null unique
);

-- Performances
create table if not exists public.performances (
  id serial primary key,
  festival_id integer references festivals(id) on delete cascade,
  stage_id integer references stages(id) on delete cascade,
  artist_id integer references artists(id) on delete set null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  day_date date not null
);

-- User preferences for performances
create table if not exists public.user_performance_preferences (
  id serial primary key,
  user_id uuid references auth.users(id) on delete cascade,
  performance_id integer references performances(id) on delete cascade,
  status text check (status in ('going','maybe','not_interested')),
  unique (user_id, performance_id)
);

-- Groups
create table if not exists public.groups (
  id serial primary key,
  festival_id integer references festivals(id) on delete cascade,
  name text not null,
  owner_user_id uuid references auth.users(id),
  created_at timestamptz default now(),
  invite_code text unique
);

-- Group members
create table if not exists public.group_members (
  id serial primary key,
  group_id integer references groups(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text default 'member',
  unique (group_id, user_id)
);

-- Helper function to upsert a user preference
create or replace function upsert_user_preference(
  p_user_id uuid,
  p_performance_id integer,
  p_status text
) returns void language plpgsql as $$
begin
  insert into public.user_performance_preferences (user_id, performance_id, status)
  values (p_user_id, p_performance_id, p_status)
  on conflict (user_id, performance_id) do
    update set status = excluded.status;
end;
$$;

-- Seed data for Ozora Festival 2026

-- Insert festival
insert into public.festivals (name, year, location, start_date, end_date)
values ('Ozora Festival', 2026, 'Dádpuszta, Hungary', '2026-07-23', '2026-07-26')
on conflict do nothing;

-- Get festival id
with f as (
  select id from public.festivals where name = 'Ozora Festival' and year = 2026
),
-- Insert Main Stage
s as (
  insert into public.stages (festival_id, name)
  select id, 'Main Stage' from f
  on conflict do nothing
  returning id
),
-- Insert artists and performances for each day
ins as (
  -- Thursday 23rd July
  insert into public.artists (name)
  values
    ('Hilight Tribe'),
    ('Shpongle (Simon Posford & Raja Ram) – LIVE'),
    ('Novelty Engine'),
    ('Star Sounds Orchestra'),
    ('Merkaba'),
    ('Strontium Dogs'),
    ('Atmos'),
    ('Eat Static')
  on conflict (name) do nothing
  returning id, name
),
ins_perf as (
  select
    a.id as artist_id,
    a.name as artist_name,
    s.id as stage_id,
    f.id as festival_id,
    v.start_time,
    v.end_time,
    v.day_date
  from (
    values
      ('Hilight Tribe', '2026-07-23 00:00:00+00', '2026-07-23 01:00:00+00', '2026-07-23'),
      ('Shpongle (Simon Posford & Raja Ram) – LIVE', '2026-07-23 01:00:00+00', '2026-07-23 02:00:00+00', '2026-07-23'),
      ('Novelty Engine', '2026-07-23 02:00:00+00', '2026-07-23 03:00:00+00', '2026-07-23'),
      ('Star Sounds Orchestra', '2026-07-23 03:00:00+00', '2026-07-23 04:00:00+00', '2026-07-23'),
      ('Merkaba', '2026-07-23 04:00:00+00', '2026-07-23 05:00:00+00', '2026-07-23'),
      ('Strontium Dogs', '2026-07-23 05:00:00+00', '2026-07-23 06:00:00+00', '2026-07-23'),
      ('Atmos', '2026-07-23 06:00:00+00', '2026-07-23 07:00:00+00', '2026-07-23'),
      ('Eat Static', '2026-07-23 07:00:00+00', '2026-07-23 08:00:00+00', '2026-07-23')
  ) as v(artist_name, start_time, end_time, day_date)
  join public.artists a on a.name = v.artist_name
  cross join s
  cross join f
)
insert into public.performances (festival_id, stage_id, artist_id, start_time, end_time, day_date)
select festival_id, stage_id, artist_id, start_time, end_time, day_date from ins_perf
on conflict do nothing;