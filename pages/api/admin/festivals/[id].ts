import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/adminAuth';
import getSupabaseAdmin from '@/lib/supabaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const { id } = req.query as { id: string };
  const festivalId = parseInt(id, 10);
  if (isNaN(festivalId)) return res.status(400).json({ error: 'Invalid festival id.' });

  if (req.method === 'PATCH') {
    const { description, location, website } = req.body as {
      description?: string | null;
      location?: string | null;
      website?: string | null;
    };

    const updates: Record<string, string | null> = {};
    if ('description' in req.body) updates.description = description ?? null;
    if ('location' in req.body) updates.location = location ?? null;
    if ('website' in req.body) updates.website = website ?? null;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update.' });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { error } = await supabaseAdmin.from('festivals').update(updates).eq('id', festivalId);
    if (error) {
      console.error('[Admin API] festival update', error);
      return res.status(500).json({ error: 'Internal server error.' });
    }

    return res.status(200).json({ ok: true, ...updates });
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
