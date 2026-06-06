-- Composite indexes for common query patterns identified in performance audit

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_preferences_user_festival
  ON public.user_performance_preferences(user_id, festival_id);

CREATE INDEX IF NOT EXISTS idx_preferences_performance_status
  ON public.user_performance_preferences(performance_id, status);

CREATE INDEX IF NOT EXISTS idx_group_members_user_group
  ON public.group_members(user_id, group_id);
