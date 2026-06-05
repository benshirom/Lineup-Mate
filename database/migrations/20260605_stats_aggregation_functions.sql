-- Aggregation helpers for admin stats endpoint.
-- These replace full-table JS aggregations with server-side GROUP BY queries.

create or replace function public.get_top_active_users(n int default 10)
returns table(user_id uuid, preference_count bigint)
language sql
security definer
set search_path = public
as $$
  select user_id, count(*) as preference_count
  from user_performance_preferences
  group by user_id
  order by preference_count desc
  limit n;
$$;

create or replace function public.get_top_saved_festivals(n int default 5)
returns table(festival_id int, save_count bigint)
language sql
security definer
set search_path = public
as $$
  select festival_id, count(*) as save_count
  from saved_festivals
  group by festival_id
  order by save_count desc
  limit n;
$$;

create or replace function public.get_top_groups_by_members(n int default 5)
returns table(group_id int, member_count bigint)
language sql
security definer
set search_path = public
as $$
  select group_id, count(*) as member_count
  from group_members
  group by group_id
  order by member_count desc
  limit n;
$$;
