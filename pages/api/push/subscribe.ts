import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import getSupabaseAdmin from '@/lib/supabaseAdmin';
import { requireUser } from '@/lib/requireUser';
import { applyRateLimit } from '@/lib/rateLimit';

const SubscribeSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().default(''),
  auth: z.string().default(''),
  platform: z.enum(['web', 'android', 'ios']).default('web'),
  device_name: z.string().max(100).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!await applyRateLimit(req, res, 'push-subscribe')) return;

  const auth = await requireUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  const { user } = auth;

  const supabaseAdmin = getSupabaseAdmin();

  if (req.method === 'POST') {
    const parsed = SubscribeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const { error } = await supabaseAdmin
      .from('push_subscriptions')
      .upsert(
        { user_id: user.id, ...parsed.data, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,endpoint' }
      );

    if (error) {
      console.error('push subscribe error:', error.message, error.code);
      return res.status(500).json({ error: 'Could not save subscription' });
    }

    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const { endpoint } = req.body ?? {};
    if (!endpoint) return res.status(400).json({ error: 'endpoint required' });

    await supabaseAdmin
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.id)
      .eq('endpoint', endpoint);

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
