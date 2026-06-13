/**
 * Web Push subscription management (browser side).
 * Called after user grants notification permission.
 */

import { createClient } from '@supabase/supabase-js';

function supabaseForToken(authToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${authToken}` } } }
  );
}

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
    const { error } = await supabaseForToken(authToken)
      .from('push_subscriptions')
      .upsert(
        {
          endpoint: json.endpoint!,
          p256dh: (json.keys as Record<string, string>)?.p256dh ?? '',
          auth: (json.keys as Record<string, string>)?.auth ?? '',
          platform: 'web',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,endpoint' }
      );

    return !error;
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

  await supabaseForToken(authToken)
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint);
}
