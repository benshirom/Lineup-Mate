import React from 'react';
import { LiveBadge } from '@/components/LiveBadge';
import { StarButton } from '@/components/festival/StarButton';
import { timeLabel } from '@/lib/festivalUtils';
import type { PerformanceItem, PreferenceStatus } from '@/lib/festivalTypes';
import type { getThemeColors } from '@/lib/platform';

interface FestivalLineupTabProps {
  allStages: { name: string; color: string }[];
  activeStages: Record<string, boolean>;
  onSetActiveStages: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  visiblePerformances: PerformanceItem[];
  selectedDayPerformances: PerformanceItem[];
  conflictIds: Set<number>;
  nowPlayingIds: Set<number>;
  loading: boolean;
  savingId: number | null;
  popId: number | null;
  onUpdatePreference: (id: number, status: PreferenceStatus | null) => void;
  c: ReturnType<typeof getThemeColors>;
}

export function FestivalLineupTab({
  allStages,
  activeStages,
  onSetActiveStages,
  visiblePerformances,
  selectedDayPerformances,
  conflictIds,
  nowPlayingIds,
  loading,
  savingId,
  popId,
  onUpdatePreference,
  c,
}: FestivalLineupTabProps) {
  return (
    <>
      <div className="mb-4 flex gap-2 overflow-x-auto scroll-hidden pb-1" data-testid="festival-stage-filters">
        {allStages.map((stage) => {
          const isOn = activeStages[stage.name] !== false;
          const hasShowsToday = selectedDayPerformances.some((p) => p.stageName === stage.name);
          return (
            <button
              key={stage.name}
              type="button"
              data-testid="festival-stage-filter"
              onClick={() => onSetActiveStages((current) => ({ ...current, [stage.name]: !isOn }))}
              className="shrink-0 tap-active rounded-full px-3 py-1.5 text-xs font-bold transition-all"
              style={{
                background: isOn ? stage.color : c.surf2,
                color: isOn ? '#fff' : c.muted,
                border: `1px solid ${isOn ? stage.color : c.brd}`,
                opacity: hasShowsToday ? 1 : 0.4,
              }}
              title={hasShowsToday ? stage.name : `${stage.name} — no shows today`}
            >
              {stage.name}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visiblePerformances.map((performance) => {
          const isGoing = performance.status === 'going';
          const hasConflict = conflictIds.has(performance.id);
          const isLive = nowPlayingIds.has(performance.id);
          return (
            <article
              key={performance.id}
              data-testid="festival-performance-block"
              className="overflow-hidden rounded-2xl perf-card"
              style={{
                background: c.surf,
                border: `1px solid ${isLive ? '#ef444444' : isGoing && hasConflict ? `${c.danger}55` : isGoing ? `${c.star}44` : c.brd}`,
                borderLeft: `4px solid ${performance.stageColor}`,
                boxShadow: isLive
                  ? '0 0 16px rgba(239,68,68,0.2)'
                  : isGoing
                  ? `0 0 14px ${isGoing && hasConflict ? `${c.danger}18` : `${c.star}12`}`
                  : 'none',
                minHeight: 72,
              }}
            >
              <div className="flex items-center gap-3 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="truncate font-bold leading-snug" style={{ color: c.txt }}>{performance.artistName}</h3>
                    {isLive && <LiveBadge />}
                  </div>
                  <p className="text-[11px] font-semibold mt-0.5" style={{ color: performance.stageColor }}>{performance.stageName}</p>
                  <p className="text-xs mt-0.5" style={{ color: c.muted }}>{timeLabel(performance.startTime)} – {timeLabel(performance.endTime)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {hasConflict && isGoing && (
                    <span className="text-xs font-bold conflict-badge" style={{ color: c.danger }}>⚠</span>
                  )}
                  <StarButton performance={performance} savingId={savingId} popId={popId} onUpdatePreference={onUpdatePreference} c={c} />
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {visiblePerformances.length === 0 && !loading && (
        <p className="mt-4 text-sm" style={{ color: c.muted }}>No shows this day.</p>
      )}
    </>
  );
}
