-- Fix infinite recursion in group_members RLS policies.
-- The previous SELECT policy queried group_members from inside a group_members policy,
-- causing Postgres to recursively evaluate the same policy.

create or replace function public.my_group_ids()
returns setof integer
language sql
stable
security definer
set search_path = public
as $$
  select gm.group_id
  from public.group_members gm
  where gm.user_id = auth.uid();
$$;

create or replace function public.my_owned_group_ids()
returns setof integer
language sql
stable
security definer
set search_path = public
as $$
  select g.id
  from public.groups g
  where g.owner_user_id = auth.uid();
$$;

create or replace function public.shares_group_with(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members mine
    join public.group_members theirs on theirs.group_id = mine.group_id
    where mine.user_id = auth.uid()
      and theirs.user_id = target_user_id
  );
$$;

revoke all on function public.my_group_ids() from public;
revoke all on function public.my_owned_group_ids() from public;
revoke all on function public.shares_group_with(uuid) from public;
grant execute on function public.my_group_ids() to authenticated;
grant execute on function public.my_owned_group_ids() to authenticated;
grant execute on function public.shares_group_with(uuid) to authenticated;

drop policy if exists "Group members can read memberships of their groups" on public.group_members;

create policy "Group members can read memberships of their groups"
on public.group_members for select
to authenticated
using (group_id in (select public.my_group_ids()));
