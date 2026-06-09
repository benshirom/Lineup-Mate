import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/adminAuth';
import getSupabaseAdmin from '@/lib/supabaseAdmin';
import { applyRateLimit } from '@/lib/rateLimit';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  if (!await applyRateLimit(req, res, 'admin-group-members')) return;

  const { id } = req.query as { id: string };
  const groupId = parseInt(id, 10);
  if (isNaN(groupId)) return res.status(400).json({ error: 'Invalid group id' });

  const supabaseAdmin = getSupabaseAdmin();

  const { data: group, error: groupError } = await supabaseAdmin.from('groups').select('festival_id').eq('id', groupId).single();
  if (groupError || !group) return res.status(404).json({ error: 'Group not found' });
  const festivalId = group.festival_id;

  const { data: members, error } = await supabaseAdmin
    .from('group_members')
    .select('user_id, role, created_at')
    .eq('group_id', groupId);

  if (error) {
    console.error('[Admin API Error] group members fetch', error);
    return res.status(500).json({ error: 'Internal server error' });
  }

  const userIds = (members ?? []).map((m) => m.user_id);

  const { data: profiles } = userIds.length > 0
    ? await supabaseAdmin.from('profiles').select('id, display_name, email').in('id', userIds)
    : { data: [] };
  const profileMap: Record<string, { display_name: string | null; email: string | null }> = {};
  for (const p of profiles ?? []) profileMap[p.id] = { display_name: p.display_name, email: p.email };
  let prefCountMap: Record<string, number> = {};

  if (userIds.length > 0 && festivalId) {
    const { data: prefs } = await supabaseAdmin
      .from('user_performance_preferences')
      .select('user_id, performance_id, performance:performances!inner(festival_id)')
      .in('user_id', userIds)
      .eq('performances.festival_id', festivalId);

    for (const p of prefs ?? []) {
      prefCountMap[p.user_id] = (prefCountMap[p.user_id] ?? 0) + 1;
    }
  }

  const result = (members ?? []).map((m) => ({
    userId: m.user_id,
    displayName: profileMap[m.user_id]?.display_name ?? null,
    email: profileMap[m.user_id]?.email ?? null,
    role: m.role,
    joinedAt: m.created_at,
    preferenceCount: prefCountMap[m.user_id] ?? 0,
  }));

  return res.status(200).json({ members: result });
}
