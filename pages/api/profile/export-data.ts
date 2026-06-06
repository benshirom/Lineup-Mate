import type { NextApiRequest, NextApiResponse } from 'next';
import getSupabaseAdmin from '@/lib/supabaseAdmin';
import { applyRateLimit } from '@/lib/rateLimit';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!await applyRateLimit(req, res, 'export-data')) return;

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const supabaseAdmin = getSupabaseAdmin();
  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !user) return res.status(401).json({ error: 'Unauthorized' });

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
    console.error('[Profile API Error] export data', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
