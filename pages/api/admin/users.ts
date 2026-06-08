import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/adminAuth';
import { applyRateLimit } from '@/lib/rateLimit';
import getSupabaseAdmin from '@/lib/supabaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const allowed = await applyRateLimit(req, res, 'admin-users');
  if (!allowed) return;

  const supabaseAdmin = getSupabaseAdmin();
  const { search, role, is_blocked, page = '0', limit = '50' } = req.query as Record<string, string>;
  const pageNum = Math.max(0, parseInt(page, 10) || 0);
  const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
  const from = pageNum * limitNum;
  const to = from + limitNum - 1;

  let query = supabaseAdmin.from('profiles').select('id, email, display_name, role, is_blocked, created_at', { count: 'exact' });
  let countQuery = supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true });

  if (search?.trim()) {
    const trimmed = search.trim().slice(0, 200);
    const pattern = `%${trimmed}%`;
    query = query.or(`email.ilike.${pattern},display_name.ilike.${pattern}`);
    countQuery = countQuery.or(`email.ilike.${pattern},display_name.ilike.${pattern}`);
  }
  if (role === 'user' || role === 'admin') {
    query = query.eq('role', role);
    countQuery = countQuery.eq('role', role);
  }
  if (is_blocked === 'true') {
    query = query.eq('is_blocked', true);
    countQuery = countQuery.eq('is_blocked', true);
  } else if (is_blocked === 'false') {
    query = query.eq('is_blocked', false);
    countQuery = countQuery.eq('is_blocked', false);
  }

  const [{ data: profiles, count }, { data: authUsers }] = await Promise.all([
    query.order('created_at', { ascending: false }).range(from, to),
    supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  if (!profiles) return res.status(500).json({ error: 'Failed to fetch users' });

  const userIds = profiles.map((p) => p.id);

  const [{ data: groupMembers }, { data: preferences }, { data: savedFests }] = await Promise.all([
    supabaseAdmin.from('group_members').select('user_id').in('user_id', userIds),
    supabaseAdmin.from('user_performance_preferences').select('user_id').in('user_id', userIds),
    supabaseAdmin.from('saved_festivals').select('user_id').in('user_id', userIds),
  ]);

  const groupCountMap: Record<string, number> = {};
  const prefCountMap: Record<string, number> = {};
  const savedCountMap: Record<string, number> = {};
  for (const r of groupMembers ?? []) groupCountMap[r.user_id] = (groupCountMap[r.user_id] ?? 0) + 1;
  for (const r of preferences ?? []) prefCountMap[r.user_id] = (prefCountMap[r.user_id] ?? 0) + 1;
  for (const r of savedFests ?? []) savedCountMap[r.user_id] = (savedCountMap[r.user_id] ?? 0) + 1;

  const authMap: Record<string, string | null> = {};
  for (const u of authUsers?.users ?? []) {
    authMap[u.id] = u.email_confirmed_at ?? null;
  }

  const users = profiles.map((p) => ({
    id: p.id,
    email: p.email,
    display_name: p.display_name,
    role: p.role,
    is_blocked: p.is_blocked,
    created_at: p.created_at,
    email_confirmed_at: authMap[p.id] ?? null,
    groupCount: groupCountMap[p.id] ?? 0,
    preferenceCount: prefCountMap[p.id] ?? 0,
    savedFestivalsCount: savedCountMap[p.id] ?? 0,
  }));

  return res.status(200).json({ users, total: count ?? 0 });
}
