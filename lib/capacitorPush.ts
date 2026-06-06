/**
 * Native push notifications via Capacitor (FCM on Android, APNS on iOS).
 * Only active when running as a native app (Capacitor.isNativePlatform()).
 * Web push is handled separately via lib/pushNotifications.ts + VAPID.
 */

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
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          endpoint: token.value,
          p256dh: '',
          auth: '',
          platform: Capacitor.getPlatform(),
        }),
      });
    } catch {
      // Silent — push registration failure is non-fatal
    }
  });

  PushNotifications.addListener('registrationError', (err: unknown) => {
    console.warn('Capacitor push registration error:', err);
  });
}
