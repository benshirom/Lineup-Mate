import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/adminAuth';
import { applyRateLimit } from '@/lib/rateLimit';
import getSupabaseAdmin from '@/lib/supabaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const allowed = await applyRateLimit(req, res, 'admin-stats');
  if (!allowed) return;

  const supabaseAdmin = getSupabaseAdmin();
  const now = new Date();
  const ago7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const ago30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const today = now.toISOString().slice(0, 10);

  const [
    { count: totalUsers },
    { count: newUsers7 },
    { count: newUsers30 },
    { count: blockedUsers },
    { data: recentSignups },
    { count: totalFestivals },
    { count: activeFestivals },
    { count: totalGroups },
    { count: newGroups7 },
    { count: newGroups30 },
    { count: blockedGroups },
    { count: totalPerformances },
    { count: totalArtists },
    { data: topActiveUserRows },
    { data: topSavedFestivalRows },
    { data: topGroupMemberRows },
  ] = await Promise.all([
    supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', ago7),
    supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', ago30),
    supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).eq('is_blocked', true),
    supabaseAdmin.from('profiles').select('id, display_name, created_at').order('created_at', { ascending: false }).limit(10),
    supabaseAdmin.from('festivals').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('festivals').select('id', { count: 'exact', head: true }).gte('end_date', today),
    supabaseAdmin.from('groups').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('groups').select('id', { count: 'exact', head: true }).gte('created_at', ago7),
    supabaseAdmin.from('groups').select('id', { count: 'exact', head: true }).gte('created_at', ago30),
    supabaseAdmin.from('groups').select('id', { count: 'exact', head: true }).eq('is_blocked', true),
    supabaseAdmin.from('performances').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('artists').select('id', { count: 'exact', head: true }),
    supabaseAdmin.rpc('get_top_active_users', { n: 10 }),
    supabaseAdmin.rpc('get_top_saved_festivals', { n: 5 }),
    supabaseAdmin.rpc('get_top_groups_by_members', { n: 5 }),
  ]);

  const topUserIds = (topActiveUserRows ?? []) as Array<{ user_id: string; preference_count: number }>;
  const topFestIds = (topSavedFestivalRows ?? []) as Array<{ festival_id: number; save_count: number }>;
  const topGroupIds = (topGroupMemberRows ?? []) as Array<{ group_id: number; member_count: number }>;

  // Fetch all enrichment data in parallel
  const [{ data: activeProfiles }, { data: savedFestivalNames }, { data: popularGroups }] = await Promise.all([
    topUserIds.length > 0
      ? supabaseAdmin.from('profiles').select('id, display_name').in('id', topUserIds.map((u) => u.user_id))
      : Promise.resolve({ data: [] }),
    topFestIds.length > 0
      ? supabaseAdmin.from('festivals').select('id, name').in('id', topFestIds.map((f) => f.festival_id))
      : Promise.resolve({ data: [] }),
    topGroupIds.length > 0
      ? supabaseAdmin.from('groups').select('id, name, festival:festivals(name)').in('id', topGroupIds.map((g) => g.group_id))
      : Promise.resolve({ data: [] }),
  ]);

  const mostActiveUsers = topUserIds.map(({ user_id, preference_count }) => {
    const p = (activeProfiles ?? []).find((pr) => pr.id === user_id);
    return { id: user_id, display_name: p?.display_name ?? null, preferenceCount: preference_count };
  });

  const mostSavedFestivals = topFestIds.map(({ festival_id, save_count }) => {
    const f = (savedFestivalNames ?? []).find((fe) => fe.id === festival_id);
    return { id: festival_id, name: f?.name ?? String(festival_id), saveCount: save_count };
  });

  const mostPopularGroups = topGroupIds.map(({ group_id, member_count }) => {
    const g = (popularGroups ?? []).find((gr) => gr.id === group_id);
    const festivalName = (g?.festival as { name?: string } | null)?.name ?? '';
    return { id: group_id, name: g?.name ?? String(group_id), festivalName, memberCount: member_count };
  });

  return res.status(200).json({
    users: {
      total: totalUsers ?? 0,
      newLast7Days: newUsers7 ?? 0,
      newLast30Days: newUsers30 ?? 0,
      blocked: blockedUsers ?? 0,
      recentSignups: recentSignups ?? [],
      mostActive: mostActiveUsers,
    },
    festivals: {
      total: totalFestivals ?? 0,
      active: activeFestivals ?? 0,
    },
    groups: {
      total: totalGroups ?? 0,
      newLast7Days: newGroups7 ?? 0,
      newLast30Days: newGroups30 ?? 0,
      blocked: blockedGroups ?? 0,
      mostPopular: mostPopularGroups,
    },
    performances: { total: totalPerformances ?? 0 },
    artists: { total: totalArtists ?? 0 },
    savedFestivals: { mostSaved: mostSavedFestivals },
  });
}
