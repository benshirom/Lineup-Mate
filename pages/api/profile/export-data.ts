import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import getSupabaseAdmin from '@/lib/supabaseAdmin';
import { applyRateLimit } from '@/lib/rateLimit';
import { requireUser } from '@/lib/requireUser';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!await applyRateLimit(req, res, 'export-data')) return;

  const auth = await requireUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  const { user } = auth;

  const supabaseAdmin = getSupabaseAdmin();

  try {
    const [
      { data: profile },
      { data: preferences },
      { data: savedFestivals },
      { data: groupMemberships },
    ] = await Promise.all([
      supabaseAdmin.from('profiles').select('id, email, display_name, avatar_url, role, theme, created_at').eq('id', user.id).single(),
      supabaseAdmin.from('user_performance_preferences').select('performance_id, status, created_at').eq('user_id', user.id),
      supabaseAdmin.from('saved_festivals').select('festival_id, created_at').eq('user_id', user.id),
      supabaseAdmin.from('group_members').select('group_id, role, created_at').eq('user_id', user.id),
    ]);

    const MAX_PREFERENCES = 5000;
    const MAX_SAVED_FESTIVALS = 1000;
    const allPreferences = preferences ?? [];
    const allSavedFestivals = savedFestivals ?? [];
    const truncatedPreferences = allPreferences.length > MAX_PREFERENCES;
    const truncatedSavedFestivals = allSavedFestivals.length > MAX_SAVED_FESTIVALS;

    const exportData = {
      exported_at: new Date().toISOString(),
      profile,
      performance_preferences: truncatedPreferences ? allPreferences.slice(0, MAX_PREFERENCES) : allPreferences,
      saved_festivals: truncatedSavedFestivals ? allSavedFestivals.slice(0, MAX_SAVED_FESTIVALS) : allSavedFestivals,
      group_memberships: groupMemberships ?? [],
      ...(truncatedPreferences || truncatedSavedFestivals
        ? { truncated: true, warning: 'Some data was truncated due to size limits.' }
        : {}),
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="lineup-mate-data.json"');
    return res.status(200).json(exportData);
  } catch (error) {
    Sentry.captureException(error, { extra: { userId: user.id, action: 'export-data' } });
    console.error('[Profile API Error] export data', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
