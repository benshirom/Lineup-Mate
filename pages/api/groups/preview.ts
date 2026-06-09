import type { NextApiRequest, NextApiResponse } from 'next';
import getSupabaseAdmin from '@/lib/supabaseAdmin';
import { applyRateLimit } from '@/lib/rateLimit';
import { z } from 'zod';

const QuerySchema = z.object({
  code: z.string().trim().min(1).max(50),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!await applyRateLimit(req, res, 'group-preview')) return;

  const parsed = QuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid invite code.' });
  }
  const { code } = parsed.data;

  const { data, error } = await getSupabaseAdmin()
    .rpc('get_group_preview', { p_code: code.toLowerCase() });

  if (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }

  if (!data || data.length === 0) {
    return res.status(404).json({ error: 'Group not found.' });
  }

  const row = data[0];
  return res.status(200).json({
    festival_name: row.festival_name,
    group_name: row.group_name,
    member_count: Number(row.member_count),
  });
}
