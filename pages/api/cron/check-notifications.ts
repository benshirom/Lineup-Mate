import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET (Netlify scheduled functions use GET)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validate cron secret to prevent unauthorized triggers
  const secret = req.headers['x-cron-secret'] || req.query.secret;
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const now = new Date();
    const windowStart = new Date(now.getTime() + 2 * 60_000);  // 2 min from now
    const windowEnd = new Date(now.getTime() + 20 * 60_000);   // 20 min from now

    // Find performances starting in the next 2-20 minutes (wide window to catch various notify_before_minutes values)
    const { data: performances, error: perfError } = await supabaseAdmin
      .from('performances')
      .select('id, artist_id, start_time, artists(name)')
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
      if (minutesBefore === undefined) continue; // user disabled notifications

      const perf = perfMap.get(pref.performance_id);
      if (!perf) continue;

      const startTime = new Date(perf.start_time);
      const minutesUntil = (startTime.getTime() - now.getTime()) / 60_000;

      // Check if this performance falls within the user's notification window
      if (minutesUntil < minutesBefore - 3 || minutesUntil > minutesBefore + 3) continue;

      const artistName = (perf as any).artists?.name || 'Artist';
      notifications.push({
        user_id: pref.user_id,
        type: 'set_starting',
        title: `🎵 ${artistName} מתחיל בקרוב!`,
        body: `ההופעה מתחילה בעוד ${Math.round(minutesUntil)} דקות`,
        performance_id: pref.performance_id,
      });
    }

    if (notifications.length === 0) {
      return res.status(200).json({ sent: 0, message: 'No notifications to send (timing mismatch)' });
    }

    // Insert notifications, ignoring duplicates via unique index
    const { error: insertError } = await supabaseAdmin
      .from('notifications')
      .upsert(notifications, {
        onConflict: 'user_id,performance_id,type',
        ignoreDuplicates: true,
      });

    if (insertError) throw insertError;

    return res.status(200).json({ sent: notifications.length });
  } catch (err: unknown) {
    console.error('check-notifications error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
