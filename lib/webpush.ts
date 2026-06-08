import webpush from 'web-push';

let initialised = false;

function ensureInit() {
  if (initialised) return;
  if (
    !process.env.VAPID_SUBJECT ||
    !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    !process.env.VAPID_PRIVATE_KEY
  ) {
    // VAPID keys not configured — push notifications disabled
    return;
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  initialised = true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export interface PushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Send a Web Push notification.
 * Returns false when the subscription has expired (caller should delete it).
 * Returns true on success.
 */
export async function sendPushNotification(
  subscription: PushSubscription,
  payload: PushPayload
): Promise<boolean> {
  ensureInit();
  if (!initialised) return false;

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify({ ...payload, icon: '/icons/icon-192.png', badge: '/icons/icon-72.png' })
    );
    return true;
  } catch (err: unknown) {
    const status = (err as { statusCode?: number })?.statusCode;
    // 410 Gone or 404 means subscription is no longer valid
    if (status === 410 || status === 404) {
      return false;
    }
    console.error('web-push error:', status, err instanceof Error ? err.message : String(err));
    return false;
  }
}
