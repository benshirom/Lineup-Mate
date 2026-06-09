import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/adminAuth';
import getSupabaseAdmin from '@/lib/supabaseAdmin';
import { applyRateLimit } from '@/lib/rateLimit';
import { z } from 'zod';

const patchSchema = z.object({
  description: z.string().max(5000).nullable().optional(),
  location: z.string().max(500).nullable().optional(),
  website: z.string().url().max(2000).nullable().optional().or(z.literal('').transform(() => null)),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  if (!await applyRateLimit(req, res, 'admin-festival-id')) return;

  const { id } = req.query as { id: string };
  const festivalId = parseInt(id, 10);
  if (isNaN(festivalId)) return res.status(400).json({ error: 'Invalid festival id.' });

  if (req.method === 'PATCH') {
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input.' });
    }
    const { description, location, website } = parsed.data;

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
