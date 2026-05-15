import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState } from 'react';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/lib/AuthContext';
import { formatDateRange, getThemeColors } from '@/lib/platform';

type PreferenceStatus = 'going' | 'maybe' | 'not_interested';
type FestivalTab = 'timeline' | 'lineup' | 'info';

interface Festival {
  id: number;
  name: string;
  name_he?: string | null;
  year: number;
  location: string | null;
  location_he?: string | null;
  start_date: string | null;
  end_date: string | null;
  description?: string | null;
  description_he?: string | null;
  website?: string | null;
  emoji?: string | null;
  color?: string | null;
  genre?: string | null;
  genre_label?: string | null;
  clashfinder_slug?: string | null;
  last_synced_at?: string | null;
}

interface PerformanceItem {
  id: number;
  artistName: string;
  stageName: string;
  stageColor: string;
  startTime: string;
  endTime: string;
  dayDate: string;
  status: PreferenceStatus | null;
}

function timeLabel(dateString: string) {
  return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function hourNumber(dateString: string) {
  const date = new Date(dateString);
  return date.getHours() + date.getMinutes() / 60;
}

function durationHours(start: string, end: string) {
  return Math.max(0.5, (new Date(end).getTime() - new Date(start).getTime()) / 36e5);
}

function festivalTitle(festival: Festival) {
  return festival.name.includes(String(festival.year)) ? festival.name : `${festival.name} ${festival.year}`;
}

function detectConflicts(performances: PerformanceItem[]): Set<number> {
  const conflictIds = new Set<number>();
  const going = performances.filter((p) => p.status === 'going');
  going.forEach((a, i) => {
    going.slice(i + 1).forEach((b) => {
      const aStart = new Date(a.startTime).getTime();
      const aEnd = new Date(a.endTime).getTime();
      const bStart = new Date(b.startTime).getTime();
      const bEnd = new Date(b.endTime).getTime();
      if (aStart < bEnd && bStart < aEnd) {
        conflictIds.add(a.id);
        conflictIds.add(b.id);
      }
    });
  });
  return conflictIds;
}

function useNowLine(hours: number[], minHour: number, hourWidth: number, selectedDay: string) {
  const [nowLeft, setNowLeft] = useState<number | null>(null);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const todayStr = now.toLocaleDateString('sv'); // YYYY-MM-DD in local time
      if (selectedDay && todayStr !== selectedDay) { setNowLeft(null); return; }
      const nowHour = now.getHours() + now.getMinutes() / 60;
      if (hours.length === 0 || nowHour < hours[0] || nowHour > hours[hours.length - 1] + 1) { setNowLeft(null); return; }
      setNowLeft((nowHour - minHour) * hourWidth);
    };
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [hours, minHour, hourWidth, selectedDay]);

  return nowLeft;
}

function useHourWidth() {
  const [w, setW] = useState(118);
  useEffect(() => {
    const update = () => setW(window.innerWidth < 640 ? 72 : 118);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return w;
}

function useStageLabelWidth() {
  const [w, setW] = useState(132);
  useEffect(() => {
    const update = () => setW(window.innerWidth < 640 ? 80 : 132);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return w;
}

export default function FestivalPage() {
  const router = useRouter();
  const { festivalId, day } = router.query;
  const { user, supabase, theme } = useAuth();
  const [festival, setFestival] = useState<Festival | null>(null);
  const [performances, setPerformances] = useState<PerformanceItem[]>([]);
  const [days, setDays] = useState<string[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [activeStages, setActiveStages] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<FestivalTab>('timeline');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [popId, setPopId] = useState<number | null>(null);
  const nowLineRef = useRef<HTMLDivElement | null>(null);

  const c = getThemeColors(theme);
  const hourWidth = useHourWidth();
  const stageLabelWidth = useStageLabelWidth();

  useEffect(() => {
    if (!festivalId) return;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      setSelectedDay('');
      setActiveStages({});

      try {
        const { data: festivalData, error: festivalError } = await supabase
          .from('festivals')
          .select('*')
          .eq('id', festivalId)
          .single();

        if (festivalError) throw festivalError;
        setFestival(festivalData as Festival);

        const { data: performanceRows, error: perfError } = await supabase
          .from('performances')
          .select('id, start_time, end_time, day_date, stages(name, color), artists(name)')
          .eq('festival_id', festivalId)
          .eq('is_active', true)
          .order('start_time');

        if (perfError) throw perfError;

        const prefMap: Record<number, PreferenceStatus> = {};
        if (user) {
          const { data: prefs, error: prefsError } = await supabase
            .from('user_performance_preferences')
            .select('performance_id,status')
            .eq('user_id', user.id);

          if (prefsError) throw prefsError;
          prefs?.forEach((pref) => {
            prefMap[pref.performance_id] = pref.status;
          });
        }

        const mapped: PerformanceItem[] = (performanceRows || []).map((row: any) => ({
          id: row.id,
          artistName: row.artists?.name || 'Unknown Artist',
          stageName: row.stages?.name || 'Stage',
          stageColor: row.stages?.color || festivalData?.color || '#e85d26',
          startTime: row.start_time,
          endTime: row.end_time,
          dayDate: row.day_date,
          status: prefMap[row.id] || null
        }));

        const nextDays = Array.from(new Set(mapped.map((performance) => performance.dayDate))).sort();
        const nextStages = Array.from(new Set(mapped.map((performance) => performance.stageName)));
        const requestedDay = typeof day === 'string' ? day : '';

        setPerformances(mapped);
        setDays(nextDays);
        setSelectedDay(nextDays.includes(requestedDay) ? requestedDay : nextDays[0] || '');
        setActiveStages(Object.fromEntries(nextStages.map((stage) => [stage, true])));
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Could not load festival data.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [festivalId, supabase, user, day]);

  const selectDay = (nextDay: string) => {
    setSelectedDay(nextDay);
    if (festivalId) {
      router.replace(`/festival/${festivalId}?day=${nextDay}`, undefined, { shallow: true });
    }
  };

  const selectedDayPerformances = useMemo(() => {
    return performances.filter((performance) => performance.dayDate === selectedDay);
  }, [performances, selectedDay]);

  const visiblePerformances = useMemo(() => {
    return selectedDayPerformances.filter((performance) => activeStages[performance.stageName] !== false);
  }, [selectedDayPerformances, activeStages]);

  const allStages = useMemo(() => {
    const stageMap = new Map<string, string>();
    performances.forEach((performance) => stageMap.set(performance.stageName, performance.stageColor));
    return Array.from(stageMap.entries()).map(([name, color]) => ({ name, color }));
  }, [performances]);

  const dayStages = useMemo(() => {
    const stageMap = new Map<string, string>();
    selectedDayPerformances.forEach((performance) => stageMap.set(performance.stageName, performance.stageColor));
    return Array.from(stageMap.entries()).map(([name, color]) => ({ name, color }));
  }, [selectedDayPerformances]);

  const hours = useMemo(() => {
    if (visiblePerformances.length === 0) return Array.from({ length: 8 }, (_, index) => index);
    const min = Math.floor(Math.min(...visiblePerformances.map((performance) => hourNumber(performance.startTime))));
    const max = Math.ceil(Math.max(...visiblePerformances.map((performance) => hourNumber(performance.endTime))));
    return Array.from({ length: Math.max(1, max - min) }, (_, index) => min + index);
  }, [visiblePerformances]);

  const requireLogin = () => {
    if (!user) {
      router.push('/login');
      return false;
    }
    return true;
  };

  const updatePreference = async (performanceId: number, status: PreferenceStatus | null) => {
    if (!requireLogin()) return;

    setSavingId(performanceId);
    setPopId(performanceId);
    setTimeout(() => setPopId(null), 280);

    try {
      const { error: rpcError } = await supabase.rpc('upsert_user_preference', {
        p_user_id: user!.id,
        p_performance_id: performanceId,
        p_status: status
      });

      if (rpcError) throw rpcError;
      setPerformances((current) => current.map((performance) => (
        performance.id === performanceId ? { ...performance, status } : performance
      )));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save your preference.');
    } finally {
      setSavingId(null);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!festival || !requireLogin()) return;
    const groupName = groupNameInput.trim();
    if (!groupName) return;

    setCreatingGroup(true);
    setError(null);

    try {
      const { data: newGroup, error: groupError } = await supabase
        .from('groups')
        .insert({ festival_id: festival.id, name: groupName, owner_user_id: user!.id })
        .select()
        .single();

      if (groupError) throw groupError;

      const { error: memberError } = await supabase
        .from('group_members')
        .insert({ group_id: newGroup.id, user_id: user!.id, role: 'owner' });

      if (memberError) throw memberError;
      router.push(`/group/${newGroup.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not create group.');
    } finally {
      setCreatingGroup(false);
      setShowCreateModal(false);
      setGroupNameInput('');
    }
  };

  const handleJoinGroup = async (event: React.FormEvent) => {
    event.preventDefault();
    setJoinError(null);

    if (!requireLogin()) return;
    if (!inviteCode.trim()) {
      setJoinError('Enter an invite code.');
      return;
    }

    try {
      const { data: joinedGroupId, error: rpcError } = await supabase.rpc('join_group_by_invite_code', {
        p_invite_code: inviteCode.trim().toLowerCase()
      });

      if (rpcError) throw rpcError;
      router.push(`/group/${joinedGroupId}`);
    } catch (err: unknown) {
      setJoinError(err instanceof Error ? err.message : 'Could not join group.');
    }
  };

  const minHour = hours[0] || 0;
  const nowLeft = useNowLine(hours, minHour, hourWidth, selectedDay);

  const conflictIds = useMemo(() => detectConflicts(performances), [performances]);
  const dayConflictCount = useMemo(
    () => selectedDayPerformances.filter((p) => conflictIds.has(p.id)).length,
    [selectedDayPerformances, conflictIds]
  );

  // auto-scroll to now-line when timeline mounts on today's day
  useEffect(() => {
    if (nowLeft !== null && nowLineRef.current) {
      nowLineRef.current.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [nowLeft, tab]);

  const renderStarButton = (performance: PerformanceItem, compact = false) => {
    const isGoing = performance.status === 'going';
    const isPopping = popId === performance.id;
    return (
      <button
        type="button"
        disabled={savingId === performance.id}
        onClick={(event) => {
          event.stopPropagation();
          updatePreference(performance.id, isGoing ? null : 'going');
        }}
        aria-label={isGoing ? 'Remove from my schedule' : 'Add to my schedule'}
        className={`inline-flex items-center justify-center rounded-full font-black transition disabled:opacity-60 ${isPopping ? 'star-pop' : ''}`}
        style={{
          width: compact ? 28 : 36,
          height: compact ? 28 : 36,
          background: isGoing ? '#ffd166' : 'rgba(0,0,0,.38)',
          color: isGoing ? '#1a1a10' : 'rgba(255,255,255,0.9)',
          border: `1.5px solid ${isGoing ? '#ffd166' : 'rgba(255,255,255,.28)'}`,
          boxShadow: isGoing ? '0 0 16px rgba(255,209,102,.5), inset 0 1px 0 rgba(255,255,255,.2)' : 'none',
          flexShrink: 0
        }}
      >
        {isGoing ? '★' : '☆'}
      </button>
    );
  };

  return (
    <>
      <Navbar />
      <main style={{ minHeight: '100vh', background: c.bg, color: c.txt }}>
        <section className="mx-auto max-w-7xl px-4 py-8">
          {loading && <p style={{ color: c.muted }}>Loading lineup…</p>}
          {error && <p className="mb-4 rounded-xl p-4 text-sm text-red-700" style={{ background: '#fee2e2', border: '1px solid #fecaca' }}>{error}</p>}

          {festival && (
            <>
              {/* ── Festival header ─────────────────────────────── */}
              <header className="fade-up mb-5 overflow-hidden rounded-[28px] shadow-2xl" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
                <div className="relative h-1.5" style={{ background: `linear-gradient(90deg, ${festival.color || c.acc}, ${c.accB})` }} />
                <div className="grid gap-5 p-5 md:grid-cols-[1fr_auto] lg:grid-cols-[1fr_280px] lg:items-center">
                  <div>
                    <div className="mb-3 flex items-center gap-3">
                      <div
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl shadow-lg"
                        style={{ background: `linear-gradient(135deg, ${festival.color || c.acc}33, ${festival.color || c.acc}11)`, border: `1px solid ${festival.color || c.acc}44` }}
                      >
                        {festival.emoji || '🎪'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-extrabold uppercase tracking-[0.18em]" style={{ color: festival.color || c.acc }}>
                          {festival.genre_label || festival.genre || 'Festival'}
                        </p>
                        <h1 className="truncate text-2xl font-black leading-tight sm:text-4xl" style={{ fontFamily: 'Syne, Nunito, sans-serif', letterSpacing: '-0.02em' }}>
                          {festivalTitle(festival)}
                        </h1>
                      </div>
                    </div>
                    {!user && <p className="mt-1 text-xs font-semibold" style={{ color: c.muted }}>Browse freely — sign in to save acts or create groups.</p>}
                  </div>
                  <div className="rounded-2xl p-4 text-sm" style={{ background: c.surf2, border: `1px solid ${c.brd}`, color: c.muted }}>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2"><span>📍</span><span>{festival.location || 'Location TBA'}</span></div>
                      <div className="flex items-center gap-2"><span>📅</span><span>{formatDateRange(festival.start_date, festival.end_date)}</span></div>
                      {festival.website && <div className="flex items-center gap-2"><span>🌐</span><span className="truncate">{festival.website}</span></div>}
                    </div>
                  </div>
                </div>
              </header>

              {/* ── Sticky tab bar + day selector ───────────────── */}
              <div
                className="sticky z-30 -mx-4 mb-5 px-4 py-3"
                style={{ top: 57, background: c.bg, borderBottom: `1px solid ${c.brd}` }}
              >
                <div className="flex items-center gap-2 overflow-x-auto scroll-hidden pb-2">
                  {(['timeline', 'lineup', 'info'] as FestivalTab[]).map((nextTab) => (
                    <button
                      key={nextTab}
                      type="button"
                      onClick={() => setTab(nextTab)}
                      className="shrink-0 rounded-full px-5 py-2 text-sm font-black capitalize"
                      style={{ background: tab === nextTab ? festival.color || c.acc : c.surf, color: tab === nextTab ? '#fff' : c.muted, border: `1px solid ${tab === nextTab ? festival.color || c.acc : c.brd}` }}
                    >
                      {nextTab}
                    </button>
                  ))}
                  {dayConflictCount > 0 && tab === 'timeline' && (
                    <span className="shrink-0 ml-auto rounded-full px-3 py-1 text-xs font-black" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.35)' }}>
                      ⚠ {dayConflictCount} conflict{dayConflictCount > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {days.length > 0 && tab !== 'info' && (
                  <div className="flex gap-2 overflow-x-auto scroll-hidden pt-2" data-testid="festival-day-tabs">
                    {days.map((nextDay) => {
                      const savedOnDay = performances.filter((p) => p.dayDate === nextDay && p.status === 'going').length;
                      return (
                        <button
                          key={nextDay}
                          type="button"
                          data-testid="festival-day-tab"
                          onClick={() => selectDay(nextDay)}
                          className="shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-black"
                          style={{ background: selectedDay === nextDay ? c.accB : c.surf, color: selectedDay === nextDay ? '#fff' : c.muted, border: `1px solid ${selectedDay === nextDay ? c.accB : c.brd}` }}
                        >
                          {new Date(nextDay).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                          {savedOnDay > 0 && (
                            <span className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-black leading-none"
                              style={{ background: selectedDay === nextDay ? 'rgba(255,255,255,0.25)' : '#ffd16633', color: selectedDay === nextDay ? '#fff' : '#ffd166' }}>
                              {savedOnDay}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Timeline tab ─────────────────────────────────── */}
              {tab === 'timeline' && (
                <section className="rounded-[28px] p-4 shadow-2xl" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
                  <div className="mb-4 flex gap-2 overflow-x-auto scroll-hidden pb-1" data-testid="festival-stage-filters">
                    {allStages.map((stage) => {
                      const isOn = activeStages[stage.name] !== false;
                      const hasShowsToday = selectedDayPerformances.some((performance) => performance.stageName === stage.name);
                      return (
                        <button
                          key={stage.name}
                          type="button"
                          data-testid="festival-stage-filter"
                          onClick={() => setActiveStages((current) => ({ ...current, [stage.name]: !isOn }))}
                          className="shrink-0 rounded-full px-3 py-1 text-xs font-black transition-all"
                          style={{ background: isOn ? stage.color : c.surf2, color: isOn ? '#fff' : c.muted, border: `1px solid ${isOn ? stage.color : c.brd}`, opacity: hasShowsToday ? 1 : 0.4, boxShadow: isOn && hasShowsToday ? `0 0 10px ${stage.color}55` : 'none' }}
                          title={hasShowsToday ? stage.name : `${stage.name} — no shows today`}
                        >
                          {stage.name}
                        </button>
                      );
                    })}
                  </div>

                  {visiblePerformances.length === 0 ? (
                    <p style={{ color: c.muted }}>No shows this day.</p>
                  ) : (
                    <div className="relative overflow-x-auto scroll-thin">
                      <p className="mb-2 text-[10px] font-bold sm:hidden" style={{ color: c.muted }}>← swipe to see full timeline →</p>
                      <div style={{ minWidth: stageLabelWidth + hours.length * hourWidth }}>
                        {/* Hour header */}
                        <div className="mb-2 flex" style={{ marginLeft: stageLabelWidth }}>
                          {hours.map((hour) => (
                            <div key={hour} className="shrink-0 pl-2 text-xs font-bold" style={{ width: hourWidth, color: c.muted, borderLeft: `1px solid ${c.brd}` }}>
                              {`${String(hour % 24).padStart(2, '0')}:00`}
                            </div>
                          ))}
                        </div>

                        {dayStages.filter((stage) => activeStages[stage.name] !== false).map((stage) => {
                          const stageItems = visiblePerformances.filter((performance) => performance.stageName === stage.name);
                          return (
                            <div key={stage.name} className="mb-2 flex items-stretch" data-testid="festival-stage-row">
                              {/* Sticky stage label */}
                              <div
                                className="shrink-0 pr-2 text-right text-xs font-black leading-tight flex items-center justify-end"
                                style={{ width: stageLabelWidth, color: stage.color, position: 'sticky', left: 0, zIndex: 2, background: c.surf }}
                              >
                                <span className="rounded-lg px-1.5 py-0.5" style={{ background: `${stage.color}15` }}>{stage.name}</span>
                              </div>
                              <div className="relative h-14 flex-1 rounded-2xl overflow-hidden" style={{ background: `${stage.color}08`, border: `1px solid ${c.brd}` }}>
                                {/* Hour grid lines */}
                                {hours.map((hour) => (
                                  <div key={hour} className="absolute top-0 h-full" style={{ left: (hour - minHour) * hourWidth, width: 1, background: c.brd }} />
                                ))}
                                {/* Now line */}
                                {nowLeft !== null && (
                                  <div
                                    ref={nowLineRef}
                                    className="now-line absolute top-0 h-full z-10 pointer-events-none"
                                    style={{ left: nowLeft, width: 2, background: '#ef4444', borderRadius: 2 }}
                                  />
                                )}
                                {/* Performance blocks */}
                                {stageItems.map((performance) => {
                                  const left = (hourNumber(performance.startTime) - minHour) * hourWidth;
                                  const width = Math.max(60, durationHours(performance.startTime, performance.endTime) * hourWidth - 4);
                                  const isGoing = performance.status === 'going';
                                  const hasConflict = conflictIds.has(performance.id);
                                  return (
                                    <div
                                      key={performance.id}
                                      data-testid="festival-performance-block"
                                      title={`${performance.artistName} · ${timeLabel(performance.startTime)}–${timeLabel(performance.endTime)}${hasConflict ? ' ⚠ Time conflict!' : ''}`}
                                      className={`perf-block absolute top-1.5 h-11 overflow-hidden rounded-xl px-2 text-left text-xs font-black text-white shadow-md ${isGoing && hasConflict ? 'conflict-block' : ''}`}
                                      style={{
                                        left,
                                        width,
                                        background: `linear-gradient(135deg, ${performance.stageColor}, ${performance.stageColor}cc)`,
                                        paddingRight: 34,
                                        boxShadow: isGoing ? `0 2px 12px ${performance.stageColor}55` : undefined
                                      }}
                                    >
                                      <span className="block truncate leading-4 pt-1">{performance.artistName}</span>
                                      <span className="block truncate text-[10px] opacity-75">{timeLabel(performance.startTime)} – {timeLabel(performance.endTime)}</span>
                                      {hasConflict && isGoing && (
                                        <span className="absolute left-1.5 bottom-1 text-[9px] font-black" style={{ color: '#fca5a5' }}>⚠</span>
                                      )}
                                      <span className="absolute right-1 top-1/2 -translate-y-1/2">{renderStarButton(performance, true)}</span>
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
                </section>
              )}

              {/* ── Lineup tab ───────────────────────────────────── */}
              {tab === 'lineup' && (
                <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {visiblePerformances.map((performance) => {
                    const isGoing = performance.status === 'going';
                    const hasConflict = conflictIds.has(performance.id);
                    return (
                      <article
                        key={performance.id}
                        className="overflow-hidden rounded-2xl transition-all"
                        style={{
                          background: c.surf,
                          border: `1px solid ${isGoing && hasConflict ? 'rgba(239,68,68,0.5)' : isGoing ? 'rgba(255,209,102,0.35)' : c.brd}`,
                          boxShadow: isGoing ? `0 0 14px ${isGoing && hasConflict ? 'rgba(239,68,68,0.15)' : 'rgba(255,209,102,0.1)'}` : 'none'
                        }}
                      >
                        <div className="h-0.5" style={{ background: `linear-gradient(90deg, ${performance.stageColor}, transparent)` }} />
                        <div className="flex items-center gap-3 p-4">
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate font-black leading-snug">{performance.artistName}</h3>
                            <p className="text-[11px] font-bold" style={{ color: performance.stageColor }}>{performance.stageName}</p>
                            <p className="text-xs mt-0.5" style={{ color: c.muted }}>{timeLabel(performance.startTime)} – {timeLabel(performance.endTime)}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {hasConflict && isGoing && <span className="text-xs font-black" style={{ color: '#ef4444' }}>⚠</span>}
                            {renderStarButton(performance)}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </section>
              )}

              {/* ── Info tab (About + Groups) ─────────────────────── */}
              {tab === 'info' && (
                <div className="space-y-4">
                  <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-[1fr_300px]">
                    <article className="rounded-3xl p-5" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
                      <h2 className="mb-3 text-xl font-black">About</h2>
                      <p className="leading-7 text-sm" style={{ color: c.muted }}>{festival.description || 'No description yet.'}</p>
                    </article>
                    <aside className="rounded-3xl p-5" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
                      <h2 className="mb-3 text-xl font-black">Festival details</h2>
                      <div className="space-y-2.5 text-sm" style={{ color: c.muted }}>
                        <div><b style={{ color: c.txt }}>Location:</b> {festival.location || 'TBA'}</div>
                        <div><b style={{ color: c.txt }}>Dates:</b> {formatDateRange(festival.start_date, festival.end_date)}</div>
                        <div><b style={{ color: c.txt }}>Stages:</b> {allStages.length}</div>
                        <div><b style={{ color: c.txt }}>Days:</b> {days.length}</div>
                        <div><b style={{ color: c.txt }}>Performances:</b> {performances.length}</div>
                        {festival.website && <div><b style={{ color: c.txt }}>Website:</b> {festival.website}</div>}
                        {festival.clashfinder_slug && <div><b style={{ color: c.txt }}>Source:</b> {festival.clashfinder_slug}</div>}
                      </div>
                    </aside>
                  </section>

                  <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-3xl p-5" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
                      <h2 className="mb-2 font-black">Create a group</h2>
                      <p className="mb-4 text-sm" style={{ color: c.muted }}>Open a shared schedule and invite friends to compare picks.</p>
                      <button type="button" onClick={() => { if (!requireLogin()) return; setShowCreateModal(true); }} className="rounded-2xl px-4 py-3 text-sm font-black text-white" style={{ background: festival.color || c.acc }}>
                        {user ? 'Create Group' : 'Sign in to Create Group'}
                      </button>
                    </div>
                    <form onSubmit={handleJoinGroup} className="rounded-3xl p-5" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
                      <h2 className="mb-2 font-black">Join a group</h2>
                      <p className="mb-4 text-sm" style={{ color: c.muted }}>Paste an invite code from a friend.</p>
                      <div className="flex gap-2">
                        <input value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} placeholder="Invite code" className="min-w-0 flex-1 rounded-2xl px-4 py-3 text-sm outline-none" style={{ background: c.surf2, border: `1px solid ${c.brd}`, color: c.txt }} />
                        <button type="submit" className="rounded-2xl px-4 py-3 text-sm font-black text-white" style={{ background: c.accB }}>
                          {user ? 'Join' : 'Sign in'}
                        </button>
                      </div>
                      {joinError && <p className="mt-2 text-sm text-red-500">{joinError}</p>}
                    </form>
                  </section>
                </div>
              )}

              {!loading && performances.length === 0 && <p style={{ color: c.muted }}>No active performances found.</p>}

              {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} onClick={() => setShowCreateModal(false)}>
                  <div className="w-full max-w-sm rounded-[28px] p-6 shadow-2xl" style={{ background: c.surf, border: `1px solid ${c.brd}` }} onClick={(e) => e.stopPropagation()}>
                    <h2 className="mb-1 text-2xl font-black">Create a group</h2>
                    <p className="mb-5 text-sm" style={{ color: c.muted }}>Give your group a name your friends will recognise.</p>
                    <form onSubmit={handleCreateGroup} className="space-y-4">
                      <input autoFocus type="text" value={groupNameInput} onChange={(e) => setGroupNameInput(e.target.value)} placeholder="e.g. Ozora Squad 2026" className="w-full rounded-2xl px-4 py-3 text-sm outline-none" style={{ background: c.surf2, border: `1px solid ${c.brd}`, color: c.txt }} maxLength={60} />
                      <div className="flex gap-3">
                        <button type="button" onClick={() => { setShowCreateModal(false); setGroupNameInput(''); }} className="flex-1 rounded-2xl px-4 py-3 text-sm font-black" style={{ background: c.surf2, border: `1px solid ${c.brd}`, color: c.muted }}>Cancel</button>
                        <button type="submit" disabled={!groupNameInput.trim() || creatingGroup} className="flex-1 rounded-2xl px-4 py-3 text-sm font-black text-white disabled:opacity-50" style={{ background: festival.color || c.acc }}>{creatingGroup ? 'Creating…' : 'Create'}</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </>
  );
}
