/**
 * Native push notifications via Capacitor (FCM on Android, APNS on iOS).
 * Only active when running as a native app (Capacitor.isNativePlatform()).
 * Web push is handled separately via lib/pushNotifications.ts + VAPID.
 */

import { createClient } from '@supabase/supabase-js';

export async function initCapacitorPush(authToken: string): Promise<void> {
  if (typeof window === 'undefined') return;

  let Capacitor: any;
  try {
    ({ Capacitor } = await import('@capacitor/core'));
  } catch {
    return;
  }

  if (!Capacitor.isNativePlatform()) return;

  const { PushNotifications } = await import('@capacitor/push-notifications');

  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== 'granted') return;

  await PushNotifications.register();

  PushNotifications.addListener('registration', async (token: { value: string }) => {
    try {
      const client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${authToken}` } } }
      );
      await client.from('push_subscriptions').upsert(
        {
          endpoint: token.value,
          p256dh: '',
          auth: '',
          platform: Capacitor.getPlatform(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,endpoint' }
      );
    } catch {
      // Silent — push registration failure is non-fatal
    }
  });

  PushNotifications.addListener('registrationError', (err: unknown) => {
    console.warn('Capacitor push registration error:', err);
  });
}
