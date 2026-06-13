import type { NextApiRequest } from 'next';
import getSupabaseAdmin from './supabaseAdmin';

/**
 * Validates the Bearer token and checks that the user is not blocked.
 * Use this in any API route that should be accessible to regular (non-admin) users.
 */
export async function requireUser(req: NextApiRequest) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;

  if (!token) {
    return { ok: false as const, status: 401, error: 'Unauthorized' };
  }

  const supabaseAdmin = getSupabaseAdmin();
  let user: Awaited<ReturnType<typeof supabaseAdmin.auth.getUser>>['data']['user'];
  try {
    const {
      data: { user: u },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);
    if (userError || !u) {
      return { ok: false as const, status: 401, error: 'Unauthorized' };
    }
    user = u;
  } catch {
    return { ok: false as const, status: 401, error: 'Unauthorized' };
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('is_blocked')
    .eq('id', user.id)
    .single();

  if (profile?.is_blocked) {
    return { ok: false as const, status: 403, error: 'Account suspended.' };
  }

  return { ok: true as const, user };
}
