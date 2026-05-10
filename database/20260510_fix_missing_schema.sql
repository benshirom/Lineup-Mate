-- Migration: fix missing schema gaps identified in audit
-- Adds: is_active to performances, role to profiles,
--       saved_festivals table, and metadata columns to festivals.

-- 1. performances.is_active
alter table public.performances
  add column if not exists is_active boolean not null default true;

-- 2. profiles.role
alter table public.profiles
  add column if not exists role text not null default 'user'
  check (role in ('user', 'admin'));

-- 3. Festival metadata columns
alter table public.festivals
  add column if not exists emoji        text,
  add column if not exists color        text,
  add column if not exists genre        text,
  add column if not exists genre_label  text,
  add column if not exists description  text,
  add column if not exists description_he text,
  add column if not exists name_he      text,
  add column if not exists location_he  text;

-- Update seed festival with metadata
update public.festivals
set
  emoji       = '🌀',
  color       = '#7c3aed',
  genre       = 'psy',
  genre_label = 'Psytrance',
  description = 'The legendary psychedelic trance gathering in the heart of Hungary.',
  description_he = 'מפגש הטראנס הפסיכדלי האגדי בלב הונגריה.',
  name_he     = 'פסטיבל אוזורה',
  location_he = 'דדפוסטה, הונגריה'
where name = 'Ozora Festival' and year = 2026;

-- 4. saved_festivals table
create table if not exists public.saved_festivals (
  id          serial primary key,
  user_id     uuid references auth.users(id) on delete cascade,
  festival_id integer references public.festivals(id) on delete cascade,
  created_at  timestamptz default now(),
  unique (user_id, festival_id)
);

alter table public.saved_festivals enable row level security;

drop policy if exists "Users manage own saved festivals" on public.saved_festivals;
create policy "Users manage own saved festivals"
on public.saved_festivals
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
