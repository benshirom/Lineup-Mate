import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import getSupabaseAdmin from '@/lib/supabaseAdmin';
import { strictRateLimit } from '@/lib/rateLimit';
import { requireUser } from '@/lib/requireUser';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', 'DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!strictRateLimit && process.env.NODE_ENV === 'production') {
    // Rate limiting must be configured in production for destructive endpoints.
    return res.status(503).json({ error: 'Service temporarily unavailable.' });
  }
  if (strictRateLimit) {
    const ip =
      (req.headers['x-nf-client-connection-ip'] as string) ||
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      'anonymous';
    const { success } = await strictRateLimit.limit(`delete-account:${ip}`);
    if (!success) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
  }

  const auth = await requireUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  const { user } = auth;

  const supabaseAdmin = getSupabaseAdmin();

  try {
    // Delete user data — cascade handles most foreign keys,
    // but we explicitly clean up tables without cascade.
    await Promise.all([
      supabaseAdmin.from('user_performance_preferences').delete().eq('user_id', user.id),
      supabaseAdmin.from('saved_festivals').delete().eq('user_id', user.id),
      supabaseAdmin.from('group_members').delete().eq('user_id', user.id),
    ]);

    // Delete groups owned by this user (members cascade from group_members FK)
    await supabaseAdmin.from('groups').delete().eq('owner_user_id', user.id);

    // Delete auth user first — if this fails, the profile remains intact and the user can retry.
    // Deleting profile first would leave an orphaned auth account on auth deletion failure.
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      Sentry.captureException(deleteError, { extra: { userId: user.id, action: 'delete-auth-user' } });
      console.error('[Profile API Error] delete auth user', deleteError);
      return res.status(500).json({ error: 'Internal server error' });
    }
    await supabaseAdmin.from('profiles').delete().eq('id', user.id);

    return res.status(200).json({ ok: true });
  } catch (error) {
    Sentry.captureException(error, { extra: { userId: user.id, action: 'delete-account' } });
    console.error('[Profile API Error] delete account', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
