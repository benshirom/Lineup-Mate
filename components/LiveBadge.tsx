interface LiveBadgeProps {
  compact?: boolean;
}

export function LiveBadge({ compact = false }: LiveBadgeProps) {
  return (
    <span
      data-testid="live-badge"
      className={`live-badge inline-flex items-center gap-1 font-extrabold ${
        compact ? 'text-[9px] px-1 py-0.5' : 'text-[10px] px-2 py-0.5'
      }`}
    >
      <span className="live-dot" aria-hidden="true" />
      {!compact && 'LIVE'}
    </span>
  );
}
