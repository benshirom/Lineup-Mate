'use client'

export default function OfflineBadge({
  isOffline,
  savedAt,
}: {
  isOffline: boolean
  savedAt: number | null
}) {
  if (!isOffline || !savedAt) return null

  const time = new Date(savedAt).toLocaleString('he-IL', {
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div
      role="status"
      style={{
        padding: '6px 12px',
        borderRadius: 8,
        fontSize: 13,
        background: 'rgba(250, 204, 21, 0.15)',
        color: '#a16207',
        display: 'inline-flex',
        gap: 6,
        alignItems: 'center',
      }}
    >
      <span>📡</span>
      <span>אין חיבור — מציג נתונים שמורים (עודכן: {time})</span>
    </div>
  )
}
