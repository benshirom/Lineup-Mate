import { createClient } from 'npm:@supabase/supabase-js@2'

const ALLOWED_EVENTS = new Set([
  'appReady',
  'appReadyError',
  'downloadComplete',
  'downloadFailed',
  'updateFailed',
])

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}))
    const event = String(body.event ?? '')

    if (!ALLOWED_EVENTS.has(event)) {
      return Response.json({ ok: false }, { status: 400 })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    await supabase.from('app_update_events').insert({
      event,
      version: body.version ? String(body.version).slice(0, 50) : null,
      details: body.details ? { d: String(body.details).slice(0, 500) } : null,
    })

    return Response.json({ ok: true })
  } catch {
    return Response.json({ ok: false })
  }
})
