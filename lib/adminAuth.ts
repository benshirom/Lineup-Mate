import type { NextApiRequest } from 'next';
import getSupabaseAdmin from './supabaseAdmin';

export async function requireAdmin(req: NextApiRequest) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;

  if (!token) {
    return { ok: false as const, status: 401, error: 'Missing authorization token.' };
  }

  const supabaseAdmin = getSupabaseAdmin();
  const {
    data: { user },
    error: userError
  } = await supabaseAdmin.auth.getUser(token);

  if (userError || !user) {
    return { ok: false as const, status: 401, error: 'Invalid authorization token.' };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role, is_blocked')
    .eq('id', user.id)
    .single();

  if (profileError || profile?.role !== 'admin') {
    return { ok: false as const, status: 403, error: 'Admin access required.' };
  }

  if (profile.is_blocked) {
    return { ok: false as const, status: 403, error: 'Account suspended.' };
  }

  return { ok: true as const, user };
}
