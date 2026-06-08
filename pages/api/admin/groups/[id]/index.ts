import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/adminAuth';
import getSupabaseAdmin from '@/lib/supabaseAdmin';
import { applyRateLimit } from '@/lib/rateLimit';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  if (!await applyRateLimit(req, res, 'admin-group-id')) return;

  const { id } = req.query as { id: string };
  const groupId = parseInt(id, 10);
  if (isNaN(groupId)) return res.status(400).json({ error: 'Invalid group id' });

  const supabaseAdmin = getSupabaseAdmin();

  if (req.method === 'PATCH') {
    const { is_blocked } = req.body as { is_blocked?: boolean };
    if (typeof is_blocked !== 'boolean') return res.status(400).json({ error: 'No valid fields to update' });
    const { error } = await supabaseAdmin.from('groups').update({ is_blocked }).eq('id', groupId);
    if (error) {
      console.error('[Admin API Error] group update', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
    return res.status(200).json({ ok: true, is_blocked });
  }

  if (req.method === 'DELETE') {
    await supabaseAdmin.from('group_members').delete().eq('group_id', groupId);
    const { error } = await supabaseAdmin.from('groups').delete().eq('id', groupId);
    if (error) {
      console.error('[Admin API Error] group delete', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
