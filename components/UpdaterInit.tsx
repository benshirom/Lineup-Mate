'use client'

import { useEffect } from 'react'

const EVENTS_URL =
  'https://jcokguqwmdkkzdakyamo.supabase.co/functions/v1/app-events'

function report(event: string, version?: string, details?: unknown) {
  // Fire-and-forget — event reporting failure never crashes the app
  fetch(EVENTS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, version: version ?? null, details: details ?? null }),
  }).catch(() => {})
}

export default function UpdaterInit() {
  useEffect(() => {
    import('@capacitor/core').then(({ Capacitor }) => {
      if (!Capacitor.isNativePlatform()) return

      import('@capgo/capacitor-updater').then(({ CapacitorUpdater }) => {
        // Required: without this the app rolls back automatically after 10 s
        CapacitorUpdater.notifyAppReady()
          .then((res: { bundle?: { version?: string } }) => report('appReady', res?.bundle?.version))
          .catch((e: unknown) => report('appReadyError', undefined, String(e)))

        // Monitoring: download/install failures reported to Supabase
        CapacitorUpdater.addListener('downloadFailed', (e: { version?: string }) =>
          report('downloadFailed', e?.version)
        )
        CapacitorUpdater.addListener('updateFailed', (e: { bundle?: { version?: string } }) =>
          report('updateFailed', e?.bundle?.version)
        )
        CapacitorUpdater.addListener('downloadComplete', (e: { bundle?: { version?: string } }) =>
          report('downloadComplete', e?.bundle?.version)
        )
      })
    })
  }, [])

  return null
}
