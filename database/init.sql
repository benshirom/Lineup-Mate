-- Schema and seed data for the Festival Scheduler app

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- Public user profiles. Do not query auth.users directly from the client.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz default now()
);

-- Keep profiles in sync when a new auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do update
  set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Festivals table
create table if not exists public.festivals (
  id serial primary key,
  name text not null,
  year integer not null,
  location text,
  start_date date,
  end_date date,
  unique (name, year)
);

-- Stages belong to a festival
create table if not exists public.stages (
  id serial primary key,
  festival_id integer references public.festivals(id) on delete cascade,
  name text not null,
  unique (festival_id, name)
);

-- Artists table with unique names
create table if not exists public.artists (
  id serial primary key,
  name text not null unique
);

-- Performances
create table if not exists public.performances (
  id serial primary key,
  festival_id integer references public.festivals(id) on delete cascade,
  stage_id integer references public.stages(id) on delete cascade,
  artist_id integer references public.artists(id) on delete set null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  day_date date not null,
  unique (festival_id, stage_id, artist_id, start_time)
);

-- User preferences for performances
create table if not exists public.user_performance_preferences (
  id serial primary key,
  user_id uuid references auth.users(id) on delete cascade,
  performance_id integer references public.performances(id) on delete cascade,
  status text check (status in ('going','maybe','not_interested')),
  updated_at timestamptz default now(),
  unique (user_id, performance_id)
);

-- Groups
create table if not exists public.groups (
  id serial primary key,
  festival_id integer references public.festivals(id) on delete cascade,
  name text not null,
  owner_user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  invite_code text unique not null default encode(gen_random_bytes(6), 'hex')
);

-- Group members
create table if not exists public.group_members (
  id serial primary key,
  group_id integer references public.groups(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text default 'member' check (role in ('owner','member')),
  created_at timestamptz default now(),
  unique (group_id, user_id)
);

-- Helper function to upsert a user preference
create or replace function public.upsert_user_preference(
  p_user_id uuid,
  p_performance_id integer,
  p_status text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'Not allowed';
  end if;

  if p_status is null then
    delete from public.user_performance_preferences
    where user_id = p_user_id and performance_id = p_performance_id;
    return;
  end if;

  insert into public.user_performance_preferences (user_id, performance_id, status, updated_at)
  values (p_user_id, p_performance_id, p_status, now())
  on conflict (user_id, performance_id) do update
  set status = excluded.status,
      updated_at = now();
end;
$$;

-- Join a group by invite code and return the group id.
create or replace function public.join_group_by_invite_code(p_invite_code text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id integer;
begin
  if auth.uid() is null then
    raise exception 'Must be signed in';
  end if;

  select id into v_group_id
  from public.groups
  where invite_code = lower(trim(p_invite_code));

  if v_group_id is null then
    raise exception 'Invalid invite code';
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (v_group_id, auth.uid(), 'member')
  on conflict (group_id, user_id) do nothing;

  return v_group_id;
end;
$$;

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.festivals enable row level security;
alter table public.stages enable row level security;
alter table public.artists enable row level security;
alter table public.performances enable row level security;
alter table public.user_performance_preferences enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;

-- Drop old policies so this script can be re-run safely.
drop policy if exists "Profiles are readable by authenticated users" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Festival data is readable by authenticated users" on public.festivals;
drop policy if exists "Stage data is readable by authenticated users" on public.stages;
drop policy if exists "Artist data is readable by authenticated users" on public.artists;
drop policy if exists "Performance data is readable by authenticated users" on public.performances;
drop policy if exists "Users can read their own preferences" on public.user_performance_preferences;
drop policy if exists "Users can create their own preferences" on public.user_performance_preferences;
drop policy if exists "Users can update their own preferences" on public.user_performance_preferences;
drop policy if exists "Users can delete their own preferences" on public.user_performance_preferences;
drop policy if exists "Users can read groups they belong to" on public.groups;
drop policy if exists "Users can create groups" on public.groups;
drop policy if exists "Group owners can update their groups" on public.groups;
drop policy if exists "Users can read members of their groups" on public.group_members;
drop policy if exists "Users can join groups through RPC" on public.group_members;
drop policy if exists "Group owners can manage members" on public.group_members;

create policy "Profiles are readable by authenticated users"
on public.profiles for select
to authenticated
using (true);

create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Festival data is readable by authenticated users"
on public.festivals for select
to authenticated
using (true);

create policy "Stage data is readable by authenticated users"
on public.stages for select
to authenticated
using (true);

create policy "Artist data is readable by authenticated users"
on public.artists for select
to authenticated
using (true);

create policy "Performance data is readable by authenticated users"
on public.performances for select
to authenticated
using (true);

create policy "Users can read their own preferences"
on public.user_performance_preferences for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can create their own preferences"
on public.user_performance_preferences for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own preferences"
on public.user_performance_preferences for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own preferences"
on public.user_performance_preferences for delete
to authenticated
using (auth.uid() = user_id);

create policy "Users can read groups they belong to"
on public.groups for select
to authenticated
using (
  owner_user_id = auth.uid()
  or exists (
    select 1 from public.group_members gm
    where gm.group_id = groups.id and gm.user_id = auth.uid()
  )
);

create policy "Users can create groups"
on public.groups for insert
to authenticated
with check (auth.uid() = owner_user_id);

create policy "Group owners can update their groups"
on public.groups for update
to authenticated
using (auth.uid() = owner_user_id)
with check (auth.uid() = owner_user_id);

create policy "Users can read members of their groups"
on public.group_members for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.group_members my_membership
    where my_membership.group_id = group_members.group_id
      and my_membership.user_id = auth.uid()
  )
);

create policy "Users can join groups through RPC"
on public.group_members for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Group owners can manage members"
on public.group_members for delete
to authenticated
using (
  exists (
    select 1 from public.groups g
    where g.id = group_members.group_id
      and g.owner_user_id = auth.uid()
  )
  or user_id = auth.uid()
);

-- Seed data for Ozora Festival 2026
insert into public.festivals (name, year, location, start_date, end_date)
values ('Ozora Festival', 2026, 'Dádpuszta, Hungary', '2026-07-23', '2026-07-26')
on conflict (name, year) do nothing;

with festival_row as (
  select id from public.festivals where name = 'Ozora Festival' and year = 2026
),
stage_row as (
  insert into public.stages (festival_id, name)
  select id, 'Main Stage' from festival_row
  on conflict (festival_id, name) do update set name = excluded.name
  returning id, festival_id
),
artist_rows as (
  insert into public.artists (name)
  values
    ('Hilight Tribe'),
    ('Shpongle (Simon Posford & Raja Ram) – LIVE'),
    ('Novelty Engine'),
    ('Star Sounds Orchestra'),
    ('Merkaba'),
    ('Strontium Dogs'),
    ('Atmos'),
    ('Eat Static'),
    ('Egorythmia'),
    ('Grouch'),
    ('Astrix'),
    ('Raja Ram & Lucas'),
    ('Thatha'),
    ('Ajja'),
    ('Tristan'),
    ('Ace Ventura'),
    ('Aardvarkk'),
    ('8ternal Beings'),
    ('Starlab'),
    ('Undefined Behavior'),
    ('He She It'),
    ('Psynonima'),
    ('Cyber Aghori'),
    ('Weirdos')
  on conflict (name) do update set name = excluded.name
  returning id, name
),
all_artists as (
  select id, name from public.artists
),
seed_performances as (
  select * from (
    values
      ('Hilight Tribe', '2026-07-23 00:00:00+00'::timestamptz, '2026-07-23 01:00:00+00'::timestamptz, '2026-07-23'::date),
      ('Shpongle (Simon Posford & Raja Ram) – LIVE', '2026-07-23 01:00:00+00', '2026-07-23 02:00:00+00', '2026-07-23'),
      ('Novelty Engine', '2026-07-23 02:00:00+00', '2026-07-23 03:00:00+00', '2026-07-23'),
      ('Star Sounds Orchestra', '2026-07-23 03:00:00+00', '2026-07-23 04:00:00+00', '2026-07-23'),
      ('Merkaba', '2026-07-23 04:00:00+00', '2026-07-23 05:00:00+00', '2026-07-23'),
      ('Strontium Dogs', '2026-07-23 05:00:00+00', '2026-07-23 06:00:00+00', '2026-07-23'),
      ('Atmos', '2026-07-23 06:00:00+00', '2026-07-23 07:00:00+00', '2026-07-23'),
      ('Eat Static', '2026-07-23 07:00:00+00', '2026-07-23 08:00:00+00', '2026-07-23'),
      ('Egorythmia', '2026-07-24 08:00:00+00', '2026-07-24 09:00:00+00', '2026-07-24'),
      ('Grouch', '2026-07-24 09:00:00+00', '2026-07-24 10:00:00+00', '2026-07-24'),
      ('Astrix', '2026-07-24 10:00:00+00', '2026-07-24 11:00:00+00', '2026-07-24'),
      ('Raja Ram & Lucas', '2026-07-24 11:00:00+00', '2026-07-24 12:00:00+00', '2026-07-24'),
      ('Thatha', '2026-07-24 12:00:00+00', '2026-07-24 13:00:00+00', '2026-07-24'),
      ('Ajja', '2026-07-24 13:00:00+00', '2026-07-24 14:00:00+00', '2026-07-24'),
      ('Tristan', '2026-07-24 14:00:00+00', '2026-07-24 15:00:00+00', '2026-07-24'),
      ('Ace Ventura', '2026-07-24 15:00:00+00', '2026-07-24 16:00:00+00', '2026-07-24'),
      ('Aardvarkk', '2026-07-25 08:00:00+00', '2026-07-25 09:00:00+00', '2026-07-25'),
      ('8ternal Beings', '2026-07-25 09:00:00+00', '2026-07-25 10:00:00+00', '2026-07-25'),
      ('Starlab', '2026-07-25 10:00:00+00', '2026-07-25 11:00:00+00', '2026-07-25'),
      ('Undefined Behavior', '2026-07-25 11:00:00+00', '2026-07-25 12:00:00+00', '2026-07-25'),
      ('He She It', '2026-07-26 08:00:00+00', '2026-07-26 09:00:00+00', '2026-07-26'),
      ('Psynonima', '2026-07-26 09:00:00+00', '2026-07-26 10:00:00+00', '2026-07-26'),
      ('Cyber Aghori', '2026-07-26 10:00:00+00', '2026-07-26 11:00:00+00', '2026-07-26'),
      ('Weirdos', '2026-07-26 11:00:00+00', '2026-07-26 12:00:00+00', '2026-07-26')
  ) as v(artist_name, start_time, end_time, day_date)
)
insert into public.performances (festival_id, stage_id, artist_id, start_time, end_time, day_date)
select sr.festival_id, sr.id, aa.id, sp.start_time, sp.end_time, sp.day_date
from seed_performances sp
cross join stage_row sr
join all_artists aa on aa.name = sp.artist_name
on conflict (festival_id, stage_id, artist_id, start_time) do update
set end_time = excluded.end_time,
    day_date = excluded.day_date;
