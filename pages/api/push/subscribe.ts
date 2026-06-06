import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SubscribeSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().default(''),
  auth: z.string().default(''),
  platform: z.enum(['web', 'android', 'ios']).default('web'),
  device_name: z.string().max(100).optional(),
});

async function getUserId(req: NextApiRequest): Promise<string | null> {
  const authHeader = req.headers.authorization ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: { user } } = await supabase.auth.getUser(token);
  return user?.id ?? null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const userId = await getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const parsed = SubscribeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const { error } = await supabaseAdmin
      .from('push_subscriptions')
      .upsert(
        { user_id: userId, ...parsed.data, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,endpoint' }
      );

    if (error) {
      console.error('push subscribe error:', error);
      return res.status(500).json({ error: 'Could not save subscription' });
    }

    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const userId = await getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { endpoint } = req.body ?? {};
    if (!endpoint) return res.status(400).json({ error: 'endpoint required' });

    await supabaseAdmin
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('endpoint', endpoint);

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
