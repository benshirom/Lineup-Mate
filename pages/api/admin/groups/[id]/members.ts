import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/adminAuth';
import getSupabaseAdmin from '@/lib/supabaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const { id } = req.query as { id: string };
  const groupId = parseInt(id, 10);
  if (isNaN(groupId)) return res.status(400).json({ error: 'Invalid group id' });

  const supabaseAdmin = getSupabaseAdmin();

  const { data: group } = await supabaseAdmin.from('groups').select('festival_id').eq('id', groupId).single();
  const festivalId = group?.festival_id;

  const { data: members, error } = await supabaseAdmin
    .from('group_members')
    .select('user_id, role, created_at, profile:profiles(display_name, email)')
    .eq('group_id', groupId);

  if (error) return res.status(500).json({ error: error.message });

  const userIds = (members ?? []).map((m) => m.user_id);
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
    displayName: (m.profile as { display_name?: string } | null)?.display_name ?? null,
    email: (m.profile as { email?: string } | null)?.email ?? null,
    role: m.role,
    joinedAt: m.created_at,
    preferenceCount: prefCountMap[m.user_id] ?? 0,
  }));

  return res.status(200).json({ members: result });
}
