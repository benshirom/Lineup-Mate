import { createClient } from 'npm:@supabase/supabase-js@2'

function log(level: 'info' | 'error', msg: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ level, fn: 'delete-account', msg, ...extra, ts: new Date().toISOString() }))
}

Deno.serve(async (req) => {
  if (req.method !== 'DELETE') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  // Verify the caller's JWT to get their uid
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const uid = user.id
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    // 1. Delete user's performance picks and saved festivals
    await Promise.all([
      supabaseAdmin.from('user_performance_preferences').delete().eq('user_id', uid),
      supabaseAdmin.from('saved_festivals').delete().eq('user_id', uid),
      supabaseAdmin.from('push_subscriptions').delete().eq('user_id', uid),
    ])

    // 2. Remove from groups; delete groups owned by this user
    await supabaseAdmin.from('group_members').delete().eq('user_id', uid)
    await supabaseAdmin.from('groups').delete().eq('owner_user_id', uid)

    // 3. Delete auth user (auth.admin.deleteUser cascades to profiles via FK trigger)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(uid)
    if (deleteError) {
      log('error', 'failed to delete auth user', { uid, error: deleteError.message })
      return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
    }

    // 4. Clean up profile row (in case FK trigger didn't cascade)
    await supabaseAdmin.from('profiles').delete().eq('id', uid)

    log('info', 'account deleted', { uid })
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  } catch (e) {
    log('error', 'unhandled exception', { uid, error: String(e) })
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
  }
})
