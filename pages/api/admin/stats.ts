import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/adminAuth';
import getSupabaseAdmin from '@/lib/supabaseAdmin';

function groupCount(rows: { id: string | number }[], key: keyof typeof rows[0]) {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const k = String(row[key]);
    counts[k] = (counts[k] ?? 0) + 1;
  }
  return counts;
}

function topN(counts: Record<string, number>, n: number) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([id, count]) => ({ id, count }));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

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
    { data: allPrefs },
    { data: allSaved },
    { data: allMembers },
  ] = await Promise.all([
    supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', ago7),
    supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', ago30),
    supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('is_blocked', true),
    supabaseAdmin.from('profiles').select('id, email, display_name, created_at').order('created_at', { ascending: false }).limit(10),
    supabaseAdmin.from('festivals').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('festivals').select('*', { count: 'exact', head: true }).gte('end_date', today),
    supabaseAdmin.from('groups').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('groups').select('*', { count: 'exact', head: true }).gte('created_at', ago7),
    supabaseAdmin.from('groups').select('*', { count: 'exact', head: true }).gte('created_at', ago30),
    supabaseAdmin.from('groups').select('*', { count: 'exact', head: true }).eq('is_blocked', true),
    supabaseAdmin.from('performances').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('artists').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('user_performance_preferences').select('user_id'),
    supabaseAdmin.from('saved_festivals').select('festival_id'),
    supabaseAdmin.from('group_members').select('group_id'),
  ]);

  // Most active users
  const prefCounts = groupCount((allPrefs ?? []) as { id: string }[], 'user_id' as never);
  const topUserIds = topN(prefCounts as Record<string, number>, 10);
  let mostActiveUsers: { id: string; display_name: string | null; email: string | null; preferenceCount: number }[] = [];
  if (topUserIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, display_name, email')
      .in('id', topUserIds.map((u) => u.id));
    mostActiveUsers = topUserIds.map(({ id, count }) => {
      const p = profiles?.find((pr) => pr.id === id);
      return { id, display_name: p?.display_name ?? null, email: p?.email ?? null, preferenceCount: count };
    });
  }

  // Most saved festivals
  const savedCounts = groupCount((allSaved ?? []) as { id: string }[], 'festival_id' as never);
  const topFestIds = topN(savedCounts as Record<string, number>, 5);
  let mostSavedFestivals: { id: number; name: string; saveCount: number }[] = [];
  if (topFestIds.length > 0) {
    const { data: festivals } = await supabaseAdmin
      .from('festivals')
      .select('id, name')
      .in('id', topFestIds.map((f) => Number(f.id)));
    mostSavedFestivals = topFestIds.map(({ id, count }) => {
      const f = festivals?.find((fe) => String(fe.id) === id);
      return { id: Number(id), name: f?.name ?? id, saveCount: count };
    });
  }

  // Most popular groups
  const memberCounts = groupCount((allMembers ?? []) as { id: string }[], 'group_id' as never);
  const topGroupIds = topN(memberCounts as Record<string, number>, 5);
  let mostPopularGroups: { id: number; name: string; festivalName: string; memberCount: number }[] = [];
  if (topGroupIds.length > 0) {
    const { data: groups } = await supabaseAdmin
      .from('groups')
      .select('id, name, festival:festivals(name)')
      .in('id', topGroupIds.map((g) => Number(g.id)));
    mostPopularGroups = topGroupIds.map(({ id, count }) => {
      const g = groups?.find((gr) => String(gr.id) === id);
      const festivalName = (g?.festival as { name?: string } | null)?.name ?? '';
      return { id: Number(id), name: g?.name ?? id, festivalName, memberCount: count };
    });
  }

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
