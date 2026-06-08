import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/adminAuth';
import getSupabaseAdmin from '@/lib/supabaseAdmin';
import { applyRateLimit } from '@/lib/rateLimit';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  if (!await applyRateLimit(req, res, 'admin-user-id')) return;

  const { id } = req.query as { id: string };
  const supabaseAdmin = getSupabaseAdmin();

  if (req.method === 'PATCH') {
    const { role, is_blocked, email_confirmed } = req.body as {
      role?: 'user' | 'admin';
      is_blocked?: boolean;
      email_confirmed?: true;
    };

    if (email_confirmed === true) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(id, { email_confirm: true });
      if (error) {
        console.error('[Admin API Error] email confirm', error);
        return res.status(500).json({ error: 'Internal server error' });
      }
      return res.status(200).json({ ok: true });
    }

    const updates: Record<string, unknown> = {};
    if (role === 'user' || role === 'admin') updates.role = role;
    if (typeof is_blocked === 'boolean') updates.is_blocked = is_blocked;

    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No valid fields to update' });

    const { error } = await supabaseAdmin.from('profiles').update(updates).eq('id', id);
    if (error) {
      console.error('[Admin API Error] user update', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
    return res.status(200).json({ ok: true, ...updates });
  }

  if (req.method === 'DELETE') {
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (authError) {
      console.error('[Admin API Error] user delete', authError);
      return res.status(500).json({ error: 'Internal server error' });
    }
    await supabaseAdmin.from('profiles').delete().eq('id', id);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
