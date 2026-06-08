import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import getSupabaseAdmin from '@/lib/supabaseAdmin';
import { sendPushNotification } from '@/lib/webpush';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET (Netlify scheduled functions use GET)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validate cron secret to prevent unauthorized triggers
  const secret = req.headers['x-cron-secret'];
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabaseAdmin = getSupabaseAdmin();

  try {
    const now = new Date();
    const windowStart = new Date(now.getTime() + 2 * 60_000);   // 2 min from now
    const windowEnd = new Date(now.getTime() + 63 * 60_000);    // 63 min from now

    // Find performances starting in the next 2-63 minutes
    const { data: performances, error: perfError } = await supabaseAdmin
      .from('performances')
      .select('id, artist_id, start_time, artists(name), stages(name)')
      .eq('is_active', true)
      .gte('start_time', windowStart.toISOString())
      .lte('start_time', windowEnd.toISOString());

    if (perfError) throw perfError;
    if (!performances || performances.length === 0) {
      return res.status(200).json({ sent: 0, message: 'No upcoming performances in window' });
    }

    const perfIds = performances.map(p => p.id);

    // Find users who are "going" to any of these performances and have notifications enabled
    const { data: goingPrefs, error: prefsError } = await supabaseAdmin
      .from('user_performance_preferences')
      .select('user_id, performance_id')
      .in('performance_id', perfIds)
      .eq('status', 'going');

    if (prefsError) throw prefsError;
    if (!goingPrefs || goingPrefs.length === 0) {
      return res.status(200).json({ sent: 0, message: 'No going preferences for upcoming performances' });
    }

    const userIds = [...new Set(goingPrefs.map(p => p.user_id))];

    // Get notification preferences for these users
    const { data: userPrefs } = await supabaseAdmin
      .from('notification_preferences')
      .select('user_id, notify_set_starting, notify_before_minutes')
      .in('user_id', userIds)
      .eq('notify_set_starting', true);

    const enabledUsers = new Map<string, number>(
      (userPrefs || []).map(p => [p.user_id, p.notify_before_minutes])
    );

    const perfMap = new Map(performances.map(p => [p.id, p]));
    const notifications: Array<{
      user_id: string;
      type: string;
      title: string;
      body: string;
      performance_id: number;
    }> = [];

    for (const pref of goingPrefs) {
      const minutesBefore = enabledUsers.get(pref.user_id);
      if (minutesBefore === undefined) continue;

      const perf = perfMap.get(pref.performance_id);
      if (!perf) continue;

      const startTime = new Date(perf.start_time);
      const minutesUntil = (startTime.getTime() - now.getTime()) / 60_000;

      if (minutesUntil < minutesBefore - 3 || minutesUntil > minutesBefore + 3) continue;

      const artistName = (perf as any).artists?.name || 'Artist';
      const stageName = (perf as any).stages?.name as string | undefined;
      const startTimeStr = new Date(perf.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      notifications.push({
        user_id: pref.user_id,
        type: 'set_starting',
        title: `🎵 ${artistName} is starting soon!`,
        body: `${stageName ? `${stageName} · ` : ''}Starting in ${Math.round(minutesUntil)} min (${startTimeStr})`,
        performance_id: pref.performance_id,
      });
    }

    if (notifications.length === 0) {
      return res.status(200).json({ sent: 0, message: 'No notifications to send (timing mismatch)' });
    }

    // Deduplicate
    const { data: existing } = await supabaseAdmin
      .from('notifications')
      .select('user_id, performance_id, type')
      .in('performance_id', notifications.map(n => n.performance_id))
      .eq('type', 'set_starting');

    const existingSet = new Set(
      (existing || []).map(n => `${n.user_id}:${n.performance_id}:${n.type}`)
    );
    const toInsert = notifications.filter(
      n => !existingSet.has(`${n.user_id}:${n.performance_id}:${n.type}`)
    );

    if (toInsert.length === 0) {
      return res.status(200).json({ sent: 0, message: 'All notifications already sent' });
    }

    const { error: insertError } = await supabaseAdmin
      .from('notifications')
      .insert(toInsert);

    if (insertError) throw insertError;

    // Send Web Push notifications to all subscribed devices
    let pushSent = 0;
    const expiredEndpoints: string[] = [];

    for (const notif of toInsert) {
      const { data: subs } = await supabaseAdmin
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .eq('user_id', notif.user_id)
        .eq('platform', 'web');

      for (const sub of subs ?? []) {
        const ok = await sendPushNotification(sub, {
          title: notif.title,
          body: notif.body,
          url: '/',
          tag: `perf-${notif.performance_id}`,
        });
        if (ok) {
          pushSent++;
        } else {
          expiredEndpoints.push(sub.endpoint);
        }
      }
    }

    // Clean up expired subscriptions
    if (expiredEndpoints.length > 0) {
      await supabaseAdmin
        .from('push_subscriptions')
        .delete()
        .in('endpoint', expiredEndpoints);
    }

    return res.status(200).json({ sent: toInsert.length, pushSent });
  } catch (err: unknown) {
    Sentry.captureException(err, { extra: { action: 'check-notifications' } });
    console.error('check-notifications error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
