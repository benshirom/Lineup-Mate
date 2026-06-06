-- Push subscriptions for Web Push (VAPID) and native push (FCM/APNS)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL,
  p256dh      TEXT NOT NULL DEFAULT '',
  auth        TEXT NOT NULL DEFAULT '',
  platform    TEXT NOT NULL DEFAULT 'web' CHECK (platform IN ('web', 'android', 'ios')),
  device_name TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own push subscriptions"
  ON public.push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions(user_id);
