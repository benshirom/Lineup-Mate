import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/adminAuth';
import { applyRateLimit } from '@/lib/rateLimit';
import { fetchClashfinderEventsList, normalizeClashfinderEventsList } from '@/lib/clashfinderEvents';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const admin = await requireAdmin(req);
  if (!admin.ok) {
    return res.status(admin.status).json({ error: admin.error });
  }

  const allowed = await applyRateLimit(req, res, 'admin-clashfinder-events');
  if (!allowed) return;

  const scope = req.query.scope === 'core' ? 'core' : 'all';
  const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
  const limit = Math.min(Number(req.query.limit || 250), 1000);

  try {
    const raw = await fetchClashfinderEventsList(scope);
    let events = normalizeClashfinderEventsList(raw);

    if (search) {
      events = events.filter((event) => {
        return event.name.toLowerCase().includes(search) || event.slug.toLowerCase().includes(search);
      });
    }

    return res.status(200).json({
      ok: true,
      scope,
      count: events.length,
      events: events.slice(0, limit)
    });
  } catch (error: unknown) {
    console.error('[Admin API Error] clashfinder events', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
