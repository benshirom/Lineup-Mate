import { createClient } from 'npm:@supabase/supabase-js@2'

function log(level: 'info' | 'warn' | 'error', msg: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ level, fn: 'app-update', msg, ...extra, ts: new Date().toISOString() }))
}

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}))
    const installedVersion: string = body.version_name ?? 'unknown'
    const platform: string = body.platform ?? 'unknown'

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data, error } = await supabase
      .from('app_versions')
      .select('version, bundle_path, checksum')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      log('error', 'db query failed', { error: error.message, installedVersion })
      return Response.json({ message: 'server error', version: '' })
    }

    if (!data) {
      log('warn', 'no active version in table', { installedVersion })
      return Response.json({ message: 'no version available', version: '' })
    }

    if (data.version === installedVersion) {
      log('info', 'device up to date', { installedVersion, platform })
      return Response.json({ message: 'up to date', version: '' })
    }

    const { data: pub } = supabase.storage
      .from('app-bundles')
      .getPublicUrl(data.bundle_path)

    log('info', 'serving update', { from: installedVersion, to: data.version, platform })

    return Response.json({
      version: data.version,
      url: pub.publicUrl,
      ...(data.checksum ? { checksum: data.checksum } : {}),
    })
  } catch (e) {
    log('error', 'unhandled exception', { error: String(e) })
    return Response.json({ message: 'error', version: '' })
  }
})
