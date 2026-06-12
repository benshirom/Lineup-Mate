import React, { useEffect, useRef, useState } from 'react';
import { StarButton } from '@/components/festival/StarButton';
import { timeLabel, absHour, durationHours, assignLanes } from '@/lib/festivalUtils';
import type { PerformanceItem, PreferenceStatus } from '@/lib/festivalTypes';
import type { getThemeColors } from '@/lib/platform';

interface FestivalTimelineTabProps {
  allStages: { name: string; color: string }[];
  activeStages: Record<string, boolean>;
  onSetActiveStages: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  selectedDayPerformances: PerformanceItem[];
  timelinePerformances: PerformanceItem[];
  hours: number[];
  refTime: number;
  hourWidth: number;
  stageLabelWidth: number;
  minHour: number;
  nowLeft: number | null;
  nowLineRef: React.MutableRefObject<HTMLDivElement | null>;
  timelineRef: React.MutableRefObject<HTMLDivElement | null>;
  conflictIds: Set<number>;
  nowPlayingIds: Set<number>;
  savingId: number | null;
  popId: number | null;
  onUpdatePreference: (id: number, status: PreferenceStatus | null) => void;
  c: ReturnType<typeof getThemeColors>;
}

interface PopoverState {
  performance: PerformanceItem;
  top: number;
  left: number;
}

export function FestivalTimelineTab({
  allStages,
  activeStages,
  onSetActiveStages,
  selectedDayPerformances,
  timelinePerformances,
  hours,
  refTime,
  hourWidth,
  stageLabelWidth,
  minHour,
  nowLeft,
  nowLineRef,
  timelineRef,
  conflictIds,
  nowPlayingIds,
  savingId,
  popId,
  onUpdatePreference,
  c,
}: FestivalTimelineTabProps) {
  const [visibleDate, setVisibleDate] = useState<string>('');
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = timelineRef.current;
    if (!el || !refTime || hours.length === 0) return;
    const update = () => {
      const centerHour = (el.scrollLeft + el.clientWidth / 2 - stageLabelWidth) / hourWidth + minHour;
      const date = new Date(refTime + centerHour * 36e5);
      setVisibleDate(date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }));
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    return () => el.removeEventListener('scroll', update);
  }, [timelineRef, refTime, hours, hourWidth, stageLabelWidth, minHour]);

  // Close popover on outside tap/click
  useEffect(() => {
    if (!popover) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (popoverRef.current?.contains(e.target as Node)) return;
      setPopover(null);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [popover]);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  const handleBlockClick = (e: React.MouseEvent | React.TouchEvent, performance: PerformanceItem) => {
    // Don't open popover if the star button was clicked
    if ((e.target as HTMLElement).closest('[data-star-btn]')) return;
    e.stopPropagation();

    if (popover?.performance.id === performance.id) {
      setPopover(null);
      return;
    }

    if (isMobile) {
      // On mobile: bottom sheet — coordinates unused
      setPopover({ performance, top: 0, left: 0 });
      return;
    }

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const popoverHeight = 130;
    const popoverWidth = 220;
    const top = rect.top > popoverHeight + 8 ? rect.top - popoverHeight - 4 : rect.bottom + 4;
    const left = Math.min(rect.left, window.innerWidth - popoverWidth - 8);
    setPopover({ performance, top, left });
  };

  return (
    <section className="rounded-3xl p-4 shadow-card" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
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
              className="shrink-0 tap-active rounded-full px-3 py-1 text-xs font-bold transition-all"
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

      {timelinePerformances.length === 0 ? (
        <p style={{ color: c.muted }}>No shows to display.</p>
      ) : (
        <div ref={timelineRef} className="relative overflow-x-auto scroll-thin">
          <p className="mb-2 text-[10px] font-bold sm:hidden" style={{ color: c.muted }}>← swipe to see full timeline →</p>
          {visibleDate && (
            <div className="sticky left-0 mb-1 w-fit rounded-full px-3 py-0.5 text-[11px] font-bold pointer-events-none" style={{ background: `${c.acc}22`, color: c.acc, border: `1px solid ${c.acc}44` }}>
              {visibleDate}
            </div>
          )}
          <div style={{ minWidth: stageLabelWidth + hours.length * hourWidth }}>
            {/* Hour header */}
            <div className="mb-2 flex" style={{ marginLeft: stageLabelWidth }}>
              {hours.map((hour) => {
                const isMidnight = hour % 24 === 0 && hour !== hours[0];
                const dateLabel = isMidnight
                  ? new Date(refTime + hour * 36e5).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                  : null;
                return (
                  <div
                    key={hour}
                    className="shrink-0 pl-2 text-xs font-bold relative"
                    style={{ width: hourWidth, color: isMidnight ? c.acc : c.muted, borderLeft: `${isMidnight ? 2 : 1}px solid ${isMidnight ? c.acc : c.brd}` }}
                  >
                    {dateLabel
                      ? <span style={{ color: c.acc, fontWeight: 800 }}>{dateLabel}</span>
                      : `${String(hour % 24).padStart(2, '0')}:00`}
                  </div>
                );
              })}
            </div>

            {allStages.filter((stage) => activeStages[stage.name] !== false).map((stage) => {
              const stageItems = timelinePerformances.filter((p) => p.stageName === stage.name);
              const lanes = assignLanes(stageItems);
              const laneCount = Math.max(1, ...Array.from(lanes.values()).map((l) => l + 1));
              const laneHeight = 56;
              const rowHeight = laneCount * laneHeight;
              return (
                <div key={stage.name} className="mb-2 flex items-stretch" data-testid="festival-stage-row">
                  <div
                    className="shrink-0 pr-2 text-right text-xs font-bold leading-tight flex items-center justify-end"
                    style={{ width: stageLabelWidth, color: stage.color, position: 'sticky', left: 0, zIndex: 2, background: c.surf }}
                  >
                    <span className="rounded-lg px-1.5 py-0.5" style={{ background: `${stage.color}18` }}>{stage.name}</span>
                  </div>
                  <div className="relative flex-1 rounded-2xl overflow-hidden" style={{ height: rowHeight, background: `${stage.color}06`, border: `1px solid ${c.brd}` }}>
                    {hours.map((hour) => {
                      const isMidnight = hour % 24 === 0 && hour !== hours[0];
                      return (
                        <div
                          key={hour}
                          className="absolute top-0 h-full"
                          style={{ left: (hour - minHour) * hourWidth, width: isMidnight ? 2 : 1, background: isMidnight ? `${c.acc}66` : c.brd }}
                        />
                      );
                    })}
                    {nowLeft !== null && (
                      <div
                        ref={nowLineRef}
                        className="now-line absolute top-0 h-full z-10 pointer-events-none"
                        style={{ left: nowLeft, width: 2, background: c.danger, borderRadius: 2 }}
                      >
                        <span className="now-label">NOW</span>
                      </div>
                    )}
                    {stageItems.map((performance) => {
                      const left = (absHour(performance.startTime, refTime) - minHour) * hourWidth;
                      const width = Math.max(60, durationHours(performance.startTime, performance.endTime) * hourWidth - 4);
                      const lane = lanes.get(performance.id) ?? 0;
                      const top = lane * laneHeight + 6;
                      const isGoing = performance.status === 'going';
                      const hasConflict = conflictIds.has(performance.id);
                      const isLive = nowPlayingIds.has(performance.id);
                      const isPopoverOpen = popover?.performance.id === performance.id;
                      return (
                        <div
                          key={performance.id}
                          data-testid="festival-performance-block"
                          className={`perf-block absolute h-11 overflow-hidden rounded-xl text-left text-xs font-bold ${isGoing && hasConflict ? 'conflict-block' : ''}`}
                          style={{
                            left,
                            top,
                            width,
                            background: c.surf2,
                            borderLeft: `3px solid ${performance.stageColor}`,
                            paddingLeft: 6,
                            paddingRight: 28,
                            color: c.txt,
                            cursor: 'pointer',
                            boxShadow: isPopoverOpen
                              ? `inset 0 0 0 2px ${performance.stageColor}`
                              : isLive
                              ? `inset 0 0 0 2px rgba(239,68,68,0.6), 0 2px 10px rgba(239,68,68,0.2)`
                              : isGoing
                              ? `inset 0 0 0 1px ${performance.stageColor}44, 0 2px 10px ${performance.stageColor}33`
                              : `inset 0 0 0 1px ${c.brd}`,
                          }}
                          onClick={(e) => handleBlockClick(e, performance)}
                        >
                          <span className="block truncate leading-4 pt-1" style={{ color: c.txt }}>{performance.artistName}</span>
                          <span className="block truncate text-[10px]" style={{ color: c.muted }}>
                            {isLive ? (
                              <span style={{ color: '#ef4444', fontWeight: 800 }}>● LIVE</span>
                            ) : `${timeLabel(performance.startTime)} – ${timeLabel(performance.endTime)}`}
                          </span>
                          {hasConflict && isGoing && (
                            <span className="absolute left-1.5 bottom-1 text-[9px] font-black" style={{ color: c.danger }}>⚠</span>
                          )}
                          <span className="absolute right-1 top-1/2 -translate-y-1/2" data-star-btn>
                            <StarButton performance={performance} savingId={savingId} popId={popId} onUpdatePreference={onUpdatePreference} compact c={c} />
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Performance detail popover / bottom sheet */}
      {popover && (
        <>
          {/* Backdrop for mobile bottom sheet */}
          {isMobile && (
            <div
              className="fixed inset-0 z-[9998]"
              style={{ background: 'rgba(0,0,0,0.4)' }}
              onClick={() => setPopover(null)}
            />
          )}
          <div
            ref={popoverRef}
            data-testid="performance-detail-popover"
            className="rounded-xl shadow-lg"
            style={isMobile ? {
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 9999,
              background: c.surf,
              borderTop: `3px solid ${popover.performance.stageColor}`,
              borderRadius: '20px 20px 0 0',
              padding: '16px 16px calc(16px + env(safe-area-inset-bottom, 0px))',
              boxShadow: '0 -4px 32px rgba(0,0,0,0.4)',
            } : {
              position: 'fixed',
              top: popover.top,
              left: popover.left,
              zIndex: 9999,
              background: c.surf,
              border: `1px solid ${popover.performance.stageColor}66`,
              minWidth: 200,
              maxWidth: 260,
              padding: '10px 12px 8px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            }}
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="font-bold text-sm leading-tight" style={{ color: c.txt }}>{popover.performance.artistName}</span>
              <button
                type="button"
                onClick={() => setPopover(null)}
                className="shrink-0 text-xs font-bold leading-none rounded-full w-6 h-6 flex items-center justify-center"
                style={{ background: c.surf2, color: c.muted }}
              >
                ×
              </button>
            </div>
            <div className="text-[11px] font-semibold mb-1" style={{ color: popover.performance.stageColor }}>
              {popover.performance.stageName}
            </div>
            <div className="text-[11px]" style={{ color: c.muted }}>
              {timeLabel(popover.performance.startTime)} – {timeLabel(popover.performance.endTime)}
            </div>
            {conflictIds.has(popover.performance.id) && popover.performance.status === 'going' && (
              <div className="mt-1 text-[10px] font-bold" style={{ color: c.danger }}>⚠ Time conflict</div>
            )}
            <div className="mt-2 flex justify-end">
              <StarButton
                performance={popover.performance}
                savingId={savingId}
                popId={popId}
                onUpdatePreference={onUpdatePreference}
                compact
                c={c}
              />
            </div>
          </div>
        </>
      )}
    </section>
  );
}
