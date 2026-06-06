/**
 * Web Push subscription management (browser side).
 * Called after user grants notification permission.
 */

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const arr = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i);
  return arr.buffer as ArrayBuffer;
}

export async function isPushSupported(): Promise<boolean> {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export async function getPushPermission(): Promise<NotificationPermission> {
  if (!(await isPushSupported())) return 'denied';
  return Notification.permission;
}

export async function requestPushPermission(): Promise<NotificationPermission> {
  if (!(await isPushSupported())) return 'denied';
  return Notification.requestPermission();
}

export async function subscribeToPush(authToken: string): Promise<boolean> {
  if (!(await isPushSupported())) return false;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) {
    console.warn('NEXT_PUBLIC_VAPID_PUBLIC_KEY not set — push disabled');
    return false;
  }

  try {
    const permission = await requestPushPermission();
    if (permission !== 'granted') return false;

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    const json = subscription.toJSON();
    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        endpoint: json.endpoint,
        p256dh: (json.keys as any)?.p256dh ?? '',
        auth: (json.keys as any)?.auth ?? '',
        platform: 'web',
      }),
    });

    return response.ok;
  } catch (err) {
    console.error('subscribeToPush error:', err);
    return false;
  }
}

export async function unsubscribeFromPush(authToken: string): Promise<void> {
  if (!(await isPushSupported())) return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();

  await fetch('/api/push/subscribe', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ endpoint }),
  });
}
