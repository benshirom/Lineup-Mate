import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/adminAuth';
import getSupabaseAdmin from '@/lib/supabaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const supabaseAdmin = getSupabaseAdmin();
  const { search, is_blocked, page = '0', limit = '50' } = req.query as Record<string, string>;
  const pageNum = Math.max(0, parseInt(page, 10) || 0);
  const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
  const from = pageNum * limitNum;
  const to = from + limitNum - 1;

  let query = supabaseAdmin
    .from('groups')
    .select('id, name, invite_code, created_at, is_blocked, festival:festivals(name), owner:profiles!owner_user_id(display_name, email)', { count: 'exact' });
  let countQuery = supabaseAdmin.from('groups').select('*', { count: 'exact', head: true });

  if (search?.trim()) {
    const pattern = `%${search.trim()}%`;
    query = query.ilike('name', pattern);
    countQuery = countQuery.ilike('name', pattern);
  }
  if (is_blocked === 'true') {
    query = query.eq('is_blocked', true);
    countQuery = countQuery.eq('is_blocked', true);
  } else if (is_blocked === 'false') {
    query = query.eq('is_blocked', false);
    countQuery = countQuery.eq('is_blocked', false);
  }

  const [{ data: groups, count }] = await Promise.all([
    query.order('created_at', { ascending: false }).range(from, to),
  ]);

  if (!groups) return res.status(500).json({ error: 'Failed to fetch groups' });

  const groupIds = groups.map((g) => g.id);
  const { data: members } = await supabaseAdmin.from('group_members').select('group_id').in('group_id', groupIds);

  const memberCountMap: Record<number, number> = {};
  for (const m of members ?? []) memberCountMap[m.group_id] = (memberCountMap[m.group_id] ?? 0) + 1;

  const result = groups.map((g) => ({
    id: g.id,
    name: g.name,
    invite_code: g.invite_code,
    created_at: g.created_at,
    is_blocked: g.is_blocked,
    festivalName: (g.festival as { name?: string } | null)?.name ?? null,
    ownerName: (g.owner as { display_name?: string; email?: string } | null)?.display_name ?? null,
    ownerEmail: (g.owner as { display_name?: string; email?: string } | null)?.email ?? null,
    memberCount: memberCountMap[g.id] ?? 0,
  }));

  return res.status(200).json({ groups: result, total: count ?? 0 });
}
