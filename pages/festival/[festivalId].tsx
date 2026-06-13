import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState } from 'react';
import Navbar from '@/components/Navbar';
import { LiveBadge } from '@/components/LiveBadge';
import InstallAfterLoginPrompt from '@/components/InstallAfterLoginPrompt';
import { Modal } from '@/components/ui/Modal';
import { FestivalArtistsTab } from '@/components/festival/FestivalArtistsTab';
import { FestivalLineupTab } from '@/components/festival/FestivalLineupTab';
import { FestivalTimelineTab } from '@/components/festival/FestivalTimelineTab';
import { FestivalInfoTab } from '@/components/festival/FestivalInfoTab';
import { useAuth } from '@/lib/AuthContext';
import { formatDateRange, getThemeColors } from '@/lib/platform';
import { isFestivalActive, formatMinutesUntil, timeLabel, festivalTitle as buildFestivalTitle, absHour } from '@/lib/festivalUtils';
import { useNowLine, useHourWidth, useStageLabelWidth } from '@/lib/useFestivalTimeline';
import type { PreferenceStatus, FestivalTab, Festival, PerformanceItem, ArtistRosterItem } from '@/lib/festivalTypes';

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

function useNowPlaying(performances: PerformanceItem[]): Set<number> {
  const [nowIds, setNowIds] = useState<Set<number>>(new Set());
  useEffect(() => {
    const update = () => {
      const now = Date.now();
      setNowIds(new Set(
        performances
          .filter((p) => new Date(p.startTime).getTime() <= now && new Date(p.endTime).getTime() > now)
          .map((p) => p.id)
      ));
    };
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [performances]);
  return nowIds;
}

function useNextPerformance(performances: PerformanceItem[], preferences: Record<number, PreferenceStatus>): PerformanceItem | null {
  const [next, setNext] = useState<PerformanceItem | null>(null);
  useEffect(() => {
    const update = () => {
      const now = Date.now();
      const upcoming = performances
        .filter((p) => preferences[p.id] === 'going' && new Date(p.startTime).getTime() > now)
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      setNext(upcoming[0] ?? null);
    };
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [performances, preferences]);
  return next;
}

export default function FestivalPage() {
  const router = useRouter();
  const { festivalId, day } = router.query;
  const { user, supabase, theme, profile } = useAuth();

  const [festival, setFestival] = useState<Festival | null>(null);
  const [performances, setPerformances] = useState<PerformanceItem[]>([]);
  const [days, setDays] = useState<string[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [activeStages, setActiveStages] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<FestivalTab>('timeline');
  const [showInstallBtn, setShowInstallBtn] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [popId, setPopId] = useState<number | null>(null);
  const [conflictWarning, setConflictWarning] = useState<{ newPerf: PerformanceItem; existing: PerformanceItem } | null>(null);
  const lastConflictRef = useRef<{ newPerf: PerformanceItem; existing: PerformanceItem } | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);

  const nowLineRef = useRef<HTMLDivElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const lastManualScrollRef = useRef(0);

  const c = getThemeColors(theme);
  const hourWidth = useHourWidth();
  const stageLabelWidth = useStageLabelWidth();

  useEffect(() => {
    const isMobile = /iPhone|iPad|iPod|Android/.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isNative = !!(window as any).Capacitor?.isNativePlatform?.();
    if (isMobile && !isStandalone && !isNative) {
      setShowInstallBtn(true);
      setCanShare(typeof navigator.share === 'function');
    }
  }, []);

  useEffect(() => {
    if (!festivalId) return;
    const loadData = async () => {
      setLoading(true);
      setError(null);
      setSelectedDay('');
      setActiveStages({});
      const festivalIdNum = Number(festivalId as string);
      try {
        const { data: festivalData, error: festivalError } = await supabase
          .from('festivals')
          .select('*')
          .eq('id', festivalIdNum)
          .single();
        if (festivalError) throw festivalError;
        setFestival(festivalData as Festival);

        const { data: performanceRows, error: perfError } = await supabase
          .from('performances')
          .select('id, start_time, end_time, day_date, stages(name, color), artists(name)')
          .eq('festival_id', festivalIdNum)
          .eq('is_active', true)
          .order('start_time')
          .limit(500);
        if (perfError) throw perfError;

        const prefMap: Record<number, PreferenceStatus> = {};
        if (user) {
          const { data: prefs, error: prefsError } = await supabase
            .from('user_performance_preferences')
            .select('performance_id,status')
            .eq('user_id', user.id);
          if (prefsError) throw prefsError;
          prefs?.forEach((pref) => {
            if (pref.performance_id != null && pref.status != null) {
              prefMap[pref.performance_id] = pref.status as PreferenceStatus;
            }
          });
        }

        type PerfRow = { id: number; start_time: string; end_time: string; day_date: string; stages: { name: string; color: string | null } | null; artists: { name: string } | null };
        const mapped: PerformanceItem[] = (performanceRows as unknown as PerfRow[] || []).map((row) => ({
          id: row.id,
          artistName: row.artists?.name || 'Unknown Artist',
          stageName: row.stages?.name || 'Stage',
          stageColor: row.stages?.color || festivalData?.color || '#8B5CF6',
          startTime: row.start_time,
          endTime: row.end_time,
          dayDate: row.day_date,
          status: prefMap[row.id] || null,
        }));

        const nextDays = Array.from(new Set(mapped.map((p) => p.dayDate))).sort();
        const nextStages = Array.from(new Set(mapped.map((p) => p.stageName)));
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

  const refTime = useMemo(() => {
    if (!performances.length) return 0;
    const d = new Date(Math.min(...performances.map((p) => new Date(p.startTime).getTime())));
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, [performances]);

  const hours = useMemo(() => {
    if (!performances.length || !refTime) return Array.from({ length: 8 }, (_, i) => i);
    const min = Math.floor(Math.min(...performances.map((p) => absHour(p.startTime, refTime))));
    const max = Math.ceil(Math.max(...performances.map((p) => absHour(p.endTime, refTime))));
    return Array.from({ length: Math.max(1, max - min) }, (_, i) => min + i);
  }, [performances, refTime]);

  const minHour = hours[0] || 0;

  const scrollToDay = (dayDate: string) => {
    if (!refTime || !timelineRef.current) return;
    const absH = (new Date(dayDate + 'T00:00:00').getTime() - refTime) / 36e5;
    timelineRef.current.scrollTo({ left: Math.max(0, (absH - minHour) * hourWidth), behavior: 'smooth' });
  };

  const selectDay = (nextDay: string) => {
    setSelectedDay(nextDay);
    if (festivalId) router.replace(`/festival/${festivalId}?day=${nextDay}`, undefined, { shallow: true });
    scrollToDay(nextDay);
  };

  const selectedDayPerformances = useMemo(
    () => performances.filter((p) => p.dayDate === selectedDay),
    [performances, selectedDay]
  );
  const visiblePerformances = useMemo(
    () => selectedDayPerformances.filter((p) => activeStages[p.stageName] !== false),
    [selectedDayPerformances, activeStages]
  );
  const timelinePerformances = useMemo(
    () => performances.filter((p) => activeStages[p.stageName] !== false),
    [performances, activeStages]
  );
  const allStages = useMemo(() => {
    const stageMap = new Map<string, string>();
    performances.forEach((p) => stageMap.set(p.stageName, p.stageColor));
    return Array.from(stageMap.entries()).map(([name, color]) => ({ name, color }));
  }, [performances]);

  const requireLogin = () => {
    if (!user) { router.push('/login'); return false; }
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
        p_status: status as unknown as string,
      });
      if (rpcError) throw rpcError;
      setPerformances((current) => {
        const updated = current.map((p) => (p.id === performanceId ? { ...p, status } : p));
        if (status === 'going') {
          const newPerf = updated.find((p) => p.id === performanceId);
          if (newPerf) {
            const newStart = new Date(newPerf.startTime).getTime();
            const newEnd = new Date(newPerf.endTime).getTime();
            const existing = updated.find((p) =>
              p.id !== performanceId &&
              p.status === 'going' &&
              new Date(p.startTime).getTime() < newEnd &&
              new Date(p.endTime).getTime() > newStart
            );
            if (existing) {
              lastConflictRef.current = { newPerf, existing };
              setConflictWarning({ newPerf, existing });
            }
          }
        }
        return updated;
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save your preference.');
    } finally {
      setSavingId(null);
    }
  };

  const toggleArtistStar = async (artist: ArtistRosterItem) => {
    if (!requireLogin()) return;
    const newStatus: PreferenceStatus | null = artist.starState === 'all' ? null : 'going';
    for (const perf of artist.performances) await updatePreference(perf.id, newStatus);
  };

  const openCreateGroupModal = () => {
    if (!requireLogin()) return;
    setGroupNameInput(festival ? `${festival.name} Group` : '');
    setShowCreateModal(true);
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

  const nowLeft = useNowLine(hours, minHour, hourWidth, refTime);
  const nowPlayingIds = useNowPlaying(performances);

  const prefMap = useMemo(() => {
    const map: Record<number, PreferenceStatus> = {};
    performances.forEach((p) => { if (p.status) map[p.id] = p.status; });
    return map;
  }, [performances]);

  const festivalIsActive = festival ? isFestivalActive(festival) : false;
  const nextPerformance = useNextPerformance(performances, prefMap);
  const conflictIds = useMemo(() => detectConflicts(performances), [performances]);
  const dayConflictCount = useMemo(
    () => selectedDayPerformances.filter((p) => conflictIds.has(p.id)).length,
    [selectedDayPerformances, conflictIds]
  );

  const artistRoster = useMemo((): ArtistRosterItem[] => {
    const map = new Map<string, PerformanceItem[]>();
    performances.forEach((p) => {
      if (!map.has(p.artistName)) map.set(p.artistName, []);
      map.get(p.artistName)!.push(p);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([artistName, perfs]) => {
        const goingCount = perfs.filter((p) => p.status === 'going').length;
        const starState: ArtistRosterItem['starState'] =
          goingCount === 0 ? 'none' : goingCount === perfs.length ? 'all' : 'mixed';
        return { artistName, performances: perfs, starState };
      });
  }, [performances]);

  useEffect(() => {
    if (nowLeft !== null && nowLineRef.current && tab === 'timeline') {
      // Only auto-scroll if user hasn't manually scrolled in last 5 minutes
      if (Date.now() - lastManualScrollRef.current > 5 * 60_000) {
        nowLineRef.current.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [nowLeft, tab]);

  useEffect(() => {
    if (tab === 'timeline' && selectedDay && refTime) {
      setTimeout(() => scrollToDay(selectedDay), 50);
    }
  // intentionally omits selectedDay/scrollToDay: only scroll when switching to timeline tab
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, refTime]);

  useEffect(() => {
    if (tab !== 'timeline') return;
    const el = timelineRef.current;
    if (!el || !refTime || !hours.length || !days.length) return;
    const onScroll = () => {
      lastManualScrollRef.current = Date.now();
      const visibleAbsHour = minHour + el.scrollLeft / hourWidth;
      const visibleDate = new Date(refTime + visibleAbsHour * 36e5).toLocaleDateString('sv');
      const match = [...days].reverse().find((d) => d <= visibleDate);
      if (match) setSelectedDay(match);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  // intentionally omits lastManualScrollRef (ref, no re-render) and scrollToDay (stable fn)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, days, refTime, hours, minHour, hourWidth]);

  return (
    <>
      <Navbar />
      <main className="mobile-shell-padding" style={{ minHeight: '100dvh', background: c.bg, color: c.txt }}>
        <section className="mx-auto max-w-7xl px-4 py-6 md:py-8">
          {loading && <p style={{ color: c.muted }}>Loading lineup…</p>}
          {error && <p className="mb-4 rounded-2xl p-4 text-sm font-semibold" style={{ background: `${c.danger}18`, color: c.danger, border: `1px solid ${c.danger}44` }}>{error}</p>}

          {festival && (
            <>
              {/* ── Festival header ─────────────────────────────── */}
              <header className="fade-up mb-5 overflow-hidden rounded-3xl shadow-card" style={{ background: c.surf, border: `1px solid ${c.brd}`, borderTop: `2px solid ${(festival.color || c.acc)}66` }}>
                <div className="p-4 sm:p-5">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div
                      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl shadow-lg"
                      style={{ background: `${festival.color || c.acc}18`, border: `1px solid ${festival.color || c.acc}44` }}
                    >
                      {festival.emoji || '🎪'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.18em]" style={{ color: festival.color || c.acc }}>
                        {festival.genre_label || festival.genre || 'Festival'}
                      </p>
                      <h1 className="truncate text-xl font-extrabold leading-tight sm:text-3xl" style={{ letterSpacing: '-0.02em' }}>
                        {buildFestivalTitle(festival.name, festival.year)}
                      </h1>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs" style={{ color: c.muted }}>
                        {festival.location && <span>📍 {festival.location}</span>}
                        <span>📅 {formatDateRange(festival.start_date, festival.end_date)}</span>
                      </div>
                    </div>
                  </div>
                  {!user && <p className="mt-3 text-xs font-semibold" style={{ color: c.muted }}>Browse freely — sign in to save acts or create groups.</p>}
                  {showInstallBtn && (
                    <div className="mt-3">
                      {canShare ? (
                        <button
                          onClick={async () => {
                            if (!user) {
                              sessionStorage.setItem('pendingInstall', '1');
                              router.push('/login?returnTo=' + encodeURIComponent(router.asPath));
                              return;
                            }
                            try { await navigator.share({ title: festival.name, url: window.location.href }); } catch { /* cancelled */ }
                          }}
                          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-white"
                          style={{ background: '#7C3AED' }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                            <polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
                          </svg>
                          Add shortcut to Home Screen
                        </button>
                      ) : (
                        <p className="text-xs" style={{ color: c.muted }}>
                          Tap <strong>⋮ Menu</strong> then <strong>&quot;Add to Home Screen&quot;</strong>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </header>
              <InstallAfterLoginPrompt />

              {/* ── What's Next banner ──────────────────────────── */}
              {festivalIsActive && nextPerformance && (
                <div data-testid="whats-next-banner" className="whats-next-banner mb-4 fade-up">
                  <span className="whats-next-label">▶ Up next:</span>
                  <strong style={{ color: '#f1f5f9' }}>{nextPerformance.artistName}</strong>
                  <span className="whats-next-stage">{nextPerformance.stageName}</span>
                  <span className="whats-next-time">
                    {formatMinutesUntil(new Date(nextPerformance.startTime).getTime() - Date.now())}
                  </span>
                </div>
              )}

              {/* ── Conflict warning ─────────────────────────────── */}
              {conflictWarning && (
                <div
                  data-testid="conflict-warning-banner"
                  className="mb-4 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold fade-up"
                  style={{ background: `${c.danger}12`, border: `1px solid ${c.danger}44`, color: c.danger }}
                >
                  <span className="text-lg shrink-0">⚠</span>
                  <div className="flex-1 min-w-0">
                    <b>{conflictWarning.newPerf.artistName}</b> conflicts with{' '}
                    <b>{conflictWarning.existing.artistName}</b> at {conflictWarning.existing.stageName}
                  </div>
                  <button
                    type="button"
                    onClick={() => setConflictWarning(null)}
                    className="shrink-0 text-xs font-bold opacity-70 hover:opacity-100"
                    aria-label="Dismiss conflict warning"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* ── Sticky tab bar + day selector ───────────────── */}
              <div
                className="sticky z-30 -mx-4 mb-5 px-4 py-3"
                style={{ top: 57, background: `${c.bg}ee`, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: `1px solid ${c.brd}` }}
              >
                <div className="flex items-center gap-2 overflow-x-auto scroll-hidden pb-1">
                  {(['timeline', 'lineup', 'artists', 'info'] as FestivalTab[]).map((nextTab) => {
                    const tabLabel =
                      nextTab === 'artists' ? 'Artists' :
                      nextTab === 'lineup' ? 'Lineup' :
                      nextTab === 'timeline' ? 'Timeline' : 'Info';
                    return (
                      <button
                        key={nextTab}
                        type="button"
                        onClick={() => setTab(nextTab)}
                        className="shrink-0 tap-active rounded-full px-5 text-sm font-bold"
                        style={{
                          background: tab === nextTab ? festival.color || c.acc : c.surf,
                          color: tab === nextTab ? '#fff' : c.muted,
                          border: `1px solid ${tab === nextTab ? festival.color || c.acc : c.brd}`,
                          minHeight: 40,
                          paddingTop: 8,
                          paddingBottom: 8,
                        }}
                      >
                        {tabLabel}
                      </button>
                    );
                  })}
                  {dayConflictCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setTab('timeline')}
                      className="shrink-0 ml-auto rounded-full px-3 py-1.5 text-xs font-bold tap-active"
                      style={{ background: `${c.danger}18`, color: c.danger, border: `1px solid ${c.danger}44` }}
                      aria-label={`${dayConflictCount} schedule conflict${dayConflictCount > 1 ? 's' : ''} — tap to view in timeline`}
                    >
                      ⚠ {dayConflictCount} conflict{dayConflictCount > 1 ? 's' : ''}
                    </button>
                  )}
                  {conflictWarning === null && lastConflictRef.current !== null && conflictIds.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setConflictWarning(lastConflictRef.current)}
                      className="shrink-0 ml-2 rounded-full px-3 py-1.5 text-xs font-bold tap-active"
                      style={{ background: `${c.danger}18`, color: c.danger, border: `1px solid ${c.danger}44` }}
                      aria-label="Show conflict warning"
                    >
                      ⚠ Show conflict
                    </button>
                  )}
                </div>

                {days.length > 0 && tab !== 'info' && tab !== 'artists' && (
                  <div className="flex gap-2 overflow-x-auto scroll-hidden pt-2" data-testid="festival-day-tabs">
                    {days.map((nextDay) => {
                      const savedOnDay = performances.filter((p) => p.dayDate === nextDay && p.status === 'going').length;
                      return (
                        <button
                          key={nextDay}
                          type="button"
                          data-testid="festival-day-tab"
                          onClick={() => selectDay(nextDay)}
                          className="shrink-0 tap-active whitespace-nowrap rounded-full px-4 text-xs font-bold"
                          style={{
                            background: selectedDay === nextDay ? c.acc : c.surf,
                            color: selectedDay === nextDay ? '#fff' : c.muted,
                            border: `1px solid ${selectedDay === nextDay ? c.acc : c.brd}`,
                            minHeight: 32,
                            paddingTop: 6,
                            paddingBottom: 6,
                          }}
                        >
                          {new Date(nextDay).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                          {savedOnDay > 0 && (
                            <span className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-black leading-none"
                              style={{ background: selectedDay === nextDay ? 'rgba(255,255,255,0.25)' : `${c.star}33`, color: selectedDay === nextDay ? '#fff' : c.star }}>
                              {savedOnDay}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {tab === 'artists' && (
                <FestivalArtistsTab
                  artistRoster={artistRoster}
                  nowPlayingIds={nowPlayingIds}
                  loading={loading}
                  onToggleArtistStar={toggleArtistStar}
                  c={c}
                />
              )}

              {tab === 'lineup' && (
                <FestivalLineupTab
                  allStages={allStages}
                  activeStages={activeStages}
                  onSetActiveStages={setActiveStages}
                  visiblePerformances={visiblePerformances}
                  selectedDayPerformances={selectedDayPerformances}
                  conflictIds={conflictIds}
                  nowPlayingIds={nowPlayingIds}
                  loading={loading}
                  savingId={savingId}
                  popId={popId}
                  onUpdatePreference={updatePreference}
                  c={c}
                />
              )}

              {tab === 'timeline' && (
                <FestivalTimelineTab
                  allStages={allStages}
                  activeStages={activeStages}
                  onSetActiveStages={setActiveStages}
                  selectedDayPerformances={selectedDayPerformances}
                  timelinePerformances={timelinePerformances}
                  hours={hours}
                  refTime={refTime}
                  hourWidth={hourWidth}
                  stageLabelWidth={stageLabelWidth}
                  minHour={minHour}
                  nowLeft={nowLeft}
                  nowLineRef={nowLineRef}
                  timelineRef={timelineRef}
                  conflictIds={conflictIds}
                  nowPlayingIds={nowPlayingIds}
                  savingId={savingId}
                  popId={popId}
                  onUpdatePreference={updatePreference}
                  c={c}
                />
              )}

              {tab === 'timeline' && nowLeft !== null && (
                <button
                  type="button"
                  data-testid="go-to-now-btn"
                  onClick={() => nowLineRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })}
                  className="go-to-now-btn"
                  aria-label="Scroll to current time"
                >
                  ▶ Now
                </button>
              )}

              {tab === 'info' && (
                <FestivalInfoTab
                  festival={festival}
                  onFestivalUpdate={setFestival}
                  allStages={allStages}
                  days={days}
                  performances={performances}
                  onCreateGroup={openCreateGroupModal}
                  c={c}
                />
              )}

              {!loading && performances.length === 0 && <p style={{ color: c.muted }}>No active performances found.</p>}

              {/* ── Create group modal ───────────────────────────── */}
              <Modal open={showCreateModal} onClose={() => { setShowCreateModal(false); setGroupNameInput(''); }} maxWidth={384}>
                <div className="p-6">
                  <h2 className="mb-1 text-2xl font-extrabold">Create a group</h2>
                  <p className="mb-5 text-sm" style={{ color: c.muted }}>Give your group a name your friends will recognise.</p>
                  <form onSubmit={handleCreateGroup} className="space-y-4">
                    <input
                      autoFocus
                      type="text"
                      value={groupNameInput}
                      onChange={(e) => setGroupNameInput(e.target.value)}
                      placeholder="e.g. Ozora Squad 2026"
                      className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
                      style={{ background: c.surf2, border: `1px solid ${c.brd}`, color: c.txt, minHeight: 48 }}
                      maxLength={60}
                    />
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => { setShowCreateModal(false); setGroupNameInput(''); }}
                        className="flex-1 tap-active rounded-2xl px-4 py-3 text-sm font-bold"
                        style={{ background: c.surf2, border: `1px solid ${c.brd}`, color: c.muted, minHeight: 48 }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={!groupNameInput.trim() || creatingGroup}
                        className="flex-1 tap-active rounded-2xl px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                        style={{ background: festival.color || c.acc, minHeight: 48 }}
                      >
                        {creatingGroup ? 'Creating…' : 'Create'}
                      </button>
                    </div>
                  </form>
                </div>
              </Modal>
            </>
          )}
        </section>
      </main>
    </>
  );
}
