-- Fix 1: Break the infinite recursion in group_members RLS.
-- The cycle: "Group members can read shared preferences" on user_performance_preferences
-- queries group_members, whose DELETE policy queries groups, whose SELECT policy
-- queries group_members → infinite loop.
-- Solution: wrap every cross-table policy check in a SECURITY DEFINER function
-- so PostgreSQL evaluates it outside the RLS stack.

-- Helper: ids of all groups the current user belongs to (bypasses RLS)
create or replace function public.my_group_ids()
returns setof integer
language sql
security definer
stable
set search_path = public
as $$
  select group_id from public.group_members where user_id = auth.uid();
$$;
revoke all on function public.my_group_ids() from public, anon;
grant execute on function public.my_group_ids() to authenticated;

-- Helper: true when the current user shares a group with target_user_id
create or replace function public.shares_group_with(target_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members me
    join public.group_members other
      on other.group_id = me.group_id
    where me.user_id  = auth.uid()
      and other.user_id = target_user_id
  );
$$;
revoke all on function public.shares_group_with(uuid) from public, anon;
grant execute on function public.shares_group_with(uuid) to authenticated;

-- Helper: ids of groups owned by the current user (bypasses RLS)
create or replace function public.my_owned_group_ids()
returns setof integer
language sql
security definer
stable
set search_path = public
as $$
  select id from public.groups where owner_user_id = auth.uid();
$$;
revoke all on function public.my_owned_group_ids() from public, anon;
grant execute on function public.my_owned_group_ids() to authenticated;

-- Rebuild user_performance_preferences shared-read policy using the helper
drop policy if exists "Group members can read shared preferences" on public.user_performance_preferences;
create policy "Group members can read shared preferences"
on public.user_performance_preferences for select
to authenticated
using (public.shares_group_with(user_id));

-- Rebuild groups read policy using the helper (breaks the group_members → groups → group_members cycle)
drop policy if exists "Users can read groups they belong to" on public.groups;
create policy "Users can read groups they belong to"
on public.groups for select
to authenticated
using (
  owner_user_id = auth.uid()
  or id in (select public.my_group_ids())
);

-- Rebuild group_members delete policy using the helper (same cycle)
drop policy if exists "Group owners can manage members" on public.group_members;
create policy "Group owners can manage members"
on public.group_members for delete
to authenticated
using (
  user_id = auth.uid()
  or group_id in (select public.my_owned_group_ids())
);

-- Fix 2: add color column to stages so stages(name, color) queries work
alter table public.stages
  add column if not exists color text;
