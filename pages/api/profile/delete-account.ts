import type { NextApiRequest, NextApiResponse } from 'next';
import getSupabaseAdmin from '@/lib/supabaseAdmin';
import { applyRateLimit } from '@/lib/rateLimit';
import { requireUser } from '@/lib/requireUser';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', 'DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!await applyRateLimit(req, res, 'delete-account')) return;

  const auth = await requireUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  const { user } = auth;

  const supabaseAdmin = getSupabaseAdmin();

  try {
    // Delete user data — cascade handles most foreign keys,
    // but we explicitly clean up tables without cascade.
    await Promise.all([
      supabaseAdmin.from('user_performance_preferences').delete().eq('user_id', user.id),
      supabaseAdmin.from('saved_festivals').delete().eq('user_id', user.id),
      supabaseAdmin.from('group_members').delete().eq('user_id', user.id),
    ]);

    // Delete groups owned by this user (members cascade from group_members FK)
    await supabaseAdmin.from('groups').delete().eq('owner_user_id', user.id);

    // Delete profile and auth user
    await supabaseAdmin.from('profiles').delete().eq('id', user.id);
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error('[Profile API Error] delete auth user', deleteError);
      return res.status(500).json({ error: 'Internal server error' });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[Profile API Error] delete account', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
