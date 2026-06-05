-- Notification preferences per user
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  notify_set_starting boolean DEFAULT true,
  notify_before_minutes integer DEFAULT 15,
  notify_group_changes boolean DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

-- In-app notification log
CREATE TABLE IF NOT EXISTS notifications (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('set_starting', 'group_change', 'schedule_change')),
  title text NOT NULL,
  body text NOT NULL,
  performance_id integer REFERENCES performances(id) ON DELETE SET NULL,
  group_id integer REFERENCES groups(id) ON DELETE SET NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Prevent duplicate notifications for the same performance+user+type
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_unique_perf
  ON notifications(user_id, performance_id, type)
  WHERE performance_id IS NOT NULL;

-- Fast unread count lookup
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, is_read)
  WHERE is_read = false;

-- RLS
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notification_preferences' AND policyname = 'Own prefs only'
  ) THEN
    CREATE POLICY "Own prefs only" ON notification_preferences FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Own notifications only'
  ) THEN
    CREATE POLICY "Own notifications only" ON notifications FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- Auto-create default preferences when a new profile is created
CREATE OR REPLACE FUNCTION create_default_notification_prefs()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO notification_preferences (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created_notification_prefs ON profiles;
CREATE TRIGGER on_profile_created_notification_prefs
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION create_default_notification_prefs();

-- Backfill existing users who don't have preferences yet
INSERT INTO notification_preferences (user_id)
  SELECT id FROM profiles
  ON CONFLICT DO NOTHING;

-- Helper: mark all notifications as read for current user
CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE notifications SET is_read = true WHERE user_id = auth.uid() AND is_read = false;
$$;
GRANT EXECUTE ON FUNCTION mark_all_notifications_read TO authenticated;
