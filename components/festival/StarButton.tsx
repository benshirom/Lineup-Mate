import type { PerformanceItem, PreferenceStatus } from '@/lib/festivalTypes';
import type { getThemeColors } from '@/lib/platform';

interface StarButtonProps {
  performance: PerformanceItem;
  savingId: number | null;
  popId: number | null;
  onUpdatePreference: (id: number, status: PreferenceStatus | null) => void;
  compact?: boolean;
  c: ReturnType<typeof getThemeColors>;
}

export function StarButton({ performance, savingId, popId, onUpdatePreference, compact = false, c }: StarButtonProps) {
  const isGoing = performance.status === 'going';
  const isPopping = popId === performance.id;
  return (
    <button
      type="button"
      disabled={savingId === performance.id}
      onClick={(event) => {
        event.stopPropagation();
        onUpdatePreference(performance.id, isGoing ? null : 'going');
      }}
      aria-label={isGoing ? 'Remove from my schedule' : 'Add to my schedule'}
      className={`inline-flex items-center justify-center rounded-full font-black transition disabled:opacity-60 ${isPopping ? 'star-pop' : ''}`}
      style={{
        width: compact ? 32 : 44,
        height: compact ? 32 : 44,
        background: isGoing ? c.star : 'rgba(0,0,0,.38)',
        color: isGoing ? '#0f0f00' : 'rgba(255,255,255,0.9)',
        border: `1.5px solid ${isGoing ? c.star : 'rgba(255,255,255,.22)'}`,
        boxShadow: isGoing ? `0 0 16px ${c.star}66, inset 0 1px 0 rgba(255,255,255,.2)` : 'none',
        flexShrink: 0,
      }}
    >
      {isGoing ? '★' : '☆'}
    </button>
  );
}
