-- Auto-save festivals when users create groups, join groups, or save performances.
-- Applied to production Supabase on 2026-05-16 and kept here for reproducibility.

create or replace function public.save_festival_for_user(
  p_user_id uuid,
  p_festival_id integer
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null or p_festival_id is null then
    return;
  end if;

  insert into public.saved_festivals (user_id, festival_id)
  values (p_user_id, p_festival_id)
  on conflict (user_id, festival_id) do nothing;
end;
$$;

create or replace function public.save_group_owner_festival()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.save_festival_for_user(new.owner_user_id, new.festival_id);
  return new;
end;
$$;

drop trigger if exists on_group_created_save_festival on public.groups;
create trigger on_group_created_save_festival
after insert on public.groups
for each row execute function public.save_group_owner_festival();

create or replace function public.upsert_user_preference(
  p_user_id uuid,
  p_performance_id integer,
  p_status text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_festival_id integer;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'Not allowed';
  end if;

  if p_status is null then
    delete from public.user_performance_preferences
    where user_id = p_user_id and performance_id = p_performance_id;
    return;
  end if;

  select festival_id into v_festival_id
  from public.performances
  where id = p_performance_id;

  insert into public.user_performance_preferences (user_id, performance_id, status, updated_at)
  values (p_user_id, p_performance_id, p_status, now())
  on conflict (user_id, performance_id) do update
  set status = excluded.status,
      updated_at = now();

  perform public.save_festival_for_user(p_user_id, v_festival_id);
end;
$$;

create or replace function public.join_group_by_invite_code(p_invite_code text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id integer;
  v_festival_id integer;
begin
  if auth.uid() is null then
    raise exception 'Must be signed in';
  end if;

  select id, festival_id into v_group_id, v_festival_id
  from public.groups
  where invite_code = lower(trim(p_invite_code));

  if v_group_id is null then
    raise exception 'Invalid invite code';
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (v_group_id, auth.uid(), 'member')
  on conflict (group_id, user_id) do nothing;

  perform public.save_festival_for_user(auth.uid(), v_festival_id);

  return v_group_id;
end;
$$;

revoke execute on function public.save_festival_for_user(uuid, integer) from anon, authenticated, public;
revoke execute on function public.save_group_owner_festival() from anon, authenticated, public;
revoke execute on function public.join_group_by_invite_code(text) from anon, public;
revoke execute on function public.upsert_user_preference(uuid, integer, text) from anon, public;
grant execute on function public.join_group_by_invite_code(text) to authenticated;
grant execute on function public.upsert_user_preference(uuid, integer, text) to authenticated;
