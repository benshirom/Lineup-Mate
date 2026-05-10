-- Performance indexes for Lineup-Mate

create index if not exists idx_group_members_user_id on public.group_members(user_id);
create index if not exists idx_groups_festival_id on public.groups(festival_id);
create index if not exists idx_groups_owner_user_id on public.groups(owner_user_id);
create index if not exists idx_performances_artist_id on public.performances(artist_id);
create index if not exists idx_performances_stage_id on public.performances(stage_id);
create index if not exists idx_user_preferences_performance_id on public.user_performance_preferences(performance_id);
create index if not exists idx_user_preferences_user_id on public.user_performance_preferences(user_id);
create index if not exists idx_performances_festival_day_start on public.performances(festival_id, day_date, start_time);
