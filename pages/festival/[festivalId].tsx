import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState } from 'react';
import Navbar from '@/components/Navbar';
import { LiveBadge } from '@/components/LiveBadge';
import { useAuth } from '@/lib/AuthContext';
import { formatDateRange, getThemeColors } from '@/lib/platform';
import { isFestivalActive, formatMinutesUntil } from '@/lib/festivalUtils';

type PreferenceStatus = 'going' | 'maybe' | 'not_interested';
type FestivalTab = 'artists' | 'lineup' | 'timeline' | 'info';

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

interface ArtistRosterItem {
  artistName: string;
  performances: PerformanceItem[];
  starState: 'all' | 'none' | 'mixed';
}

function timeLabel(dateString: string) {
  return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function absHour(dateString: string, refTime: number): number {
  return (new Date(dateString).getTime() - refTime) / 36e5;
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

function useNowLine(hours: number[], minHour: number, hourWidth: number, refTime: number) {
  const [nowLeft, setNowLeft] = useState<number | null>(null);

  useEffect(() => {
    const update = () => {
      if (!refTime) { setNowLeft(null); return; }
      const nowAbsHour = (Date.now() - refTime) / 36e5;
      if (hours.length === 0 || nowAbsHour < hours[0] || nowAbsHour > hours[hours.length - 1] + 1) { setNowLeft(null); return; }
      setNowLeft((nowAbsHour - minHour) * hourWidth);
    };
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [hours, minHour, hourWidth, refTime]);

  return nowLeft;
}

function useNowPlaying(performances: PerformanceItem[]): Set<number> {
  const [nowIds, setNowIds] = useState<Set<number>>(new Set());
  useEffect(() => {
    const update = () => {
      const now = Date.now();
      setNowIds(new Set(
        performances
          .filter(p =>
            new Date(p.startTime).getTime() <= now &&
            new Date(p.endTime).getTime() > now
          )
          .map(p => p.id)
      ));
    };
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [performances]);
  return nowIds;
}

function useNextPerformance(
  performances: PerformanceItem[],
  preferences: Record<number, PreferenceStatus>
): PerformanceItem | null {
  const [next, setNext] = useState<PerformanceItem | null>(null);
  useEffect(() => {
    const update = () => {
      const now = Date.now();
      const upcoming = performances
        .filter(p => preferences[p.id] === 'going' && new Date(p.startTime).getTime() > now)
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      setNext(upcoming[0] ?? null);
    };
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [performances, preferences]);
  return next;
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
  const { user, supabase, theme, profile } = useAuth();
  const [festival, setFestival] = useState<Festival | null>(null);
  const [performances, setPerformances] = useState<PerformanceItem[]>([]);
  const [days, setDays] = useState<string[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [activeStages, setActiveStages] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<FestivalTab>('lineup');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [popId, setPopId] = useState<number | null>(null);
  const [conflictWarning, setConflictWarning] = useState<{ newPerf: PerformanceItem; existing: PerformanceItem } | null>(null);
  const [editingInfo, setEditingInfo] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [savingInfo, setSavingInfo] = useState(false);
  const [fetchingDescription, setFetchingDescription] = useState(false);
  const nowLineRef = useRef<HTMLDivElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const lastManualScrollRef = useRef(0);

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
            prefMap[pref.performance_id] = pref.status;
          });
        }

        const mapped: PerformanceItem[] = (performanceRows || []).map((row: any) => ({
          id: row.id,
          artistName: row.artists?.name || 'Unknown Artist',
          stageName: row.stages?.name || 'Stage',
          stageColor: row.stages?.color || festivalData?.color || '#8B5CF6',
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

  const refTime = useMemo(() => {
    if (!performances.length) return 0;
    const d = new Date(Math.min(...performances.map((p) => new Date(p.startTime).getTime())));
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, [performances]);

  const scrollToDay = (dayDate: string) => {
    if (!refTime || !timelineRef.current) return;
    const absH = (new Date(dayDate + 'T00:00:00').getTime() - refTime) / 36e5;
    const minH = hours[0] || 0;
    timelineRef.current.scrollTo({ left: Math.max(0, (absH - minH) * hourWidth), behavior: 'smooth' });
  };

  const selectDay = (nextDay: string) => {
    setSelectedDay(nextDay);
    if (festivalId) {
      router.replace(`/festival/${festivalId}?day=${nextDay}`, undefined, { shallow: true });
    }
    scrollToDay(nextDay);
  };

  const selectedDayPerformances = useMemo(() => {
    return performances.filter((performance) => performance.dayDate === selectedDay);
  }, [performances, selectedDay]);

  const visiblePerformances = useMemo(() => {
    return selectedDayPerformances.filter((performance) => activeStages[performance.stageName] !== false);
  }, [selectedDayPerformances, activeStages]);

  const timelinePerformances = useMemo(() => {
    return performances.filter((performance) => activeStages[performance.stageName] !== false);
  }, [performances, activeStages]);

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
    if (!performances.length || !refTime) return Array.from({ length: 8 }, (_, i) => i);
    const min = Math.floor(Math.min(...performances.map((p) => absHour(p.startTime, refTime))));
    const max = Math.ceil(Math.max(...performances.map((p) => absHour(p.endTime, refTime))));
    return Array.from({ length: Math.max(1, max - min) }, (_, i) => min + i);
  }, [performances, refTime]);

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
      setPerformances((current) => {
        const updated = current.map((performance) => (
          performance.id === performanceId ? { ...performance, status } : performance
        ));
        // Check for conflict when marking as going
        if (status === 'going') {
          const newPerf = updated.find(p => p.id === performanceId);
          if (newPerf) {
            const newStart = new Date(newPerf.startTime).getTime();
            const newEnd = new Date(newPerf.endTime).getTime();
            const existing = updated.find(p =>
              p.id !== performanceId &&
              p.status === 'going' &&
              new Date(p.startTime).getTime() < newEnd &&
              new Date(p.endTime).getTime() > newStart
            );
            if (existing) {
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
    for (const perf of artist.performances) {
      await updatePreference(perf.id, newStatus);
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

  const openCreateGroupModal = () => {
    if (!requireLogin()) return;
    setGroupNameInput(festival ? `${festival.name} Group` : '');
    setShowCreateModal(true);
  };

  const minHour = hours[0] || 0;
  const nowLeft = useNowLine(hours, minHour, hourWidth, refTime);
  const nowPlayingIds = useNowPlaying(performances);

  const prefMap = useMemo(() => {
    const map: Record<number, PreferenceStatus> = {};
    performances.forEach(p => { if (p.status) map[p.id] = p.status; });
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, refTime]);

  // Sync selected day button as user scrolls the timeline
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, days, refTime, hours, minHour, hourWidth]);

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
          width: compact ? 32 : 44,
          height: compact ? 32 : 44,
          background: isGoing ? c.star : 'rgba(0,0,0,.38)',
          color: isGoing ? '#0f0f00' : 'rgba(255,255,255,0.9)',
          border: `1.5px solid ${isGoing ? c.star : 'rgba(255,255,255,.22)'}`,
          boxShadow: isGoing ? `0 0 16px ${c.star}66, inset 0 1px 0 rgba(255,255,255,.2)` : 'none',
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
      <main className="mobile-shell-padding" style={{ minHeight: '100vh', background: c.bg, color: c.txt }}>
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
                        {festivalTitle(festival)}
                      </h1>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs" style={{ color: c.muted }}>
                        {festival.location && <span>📍 {festival.location}</span>}
                        <span>📅 {formatDateRange(festival.start_date, festival.end_date)}</span>
                      </div>
                    </div>
                  </div>
                  {!user && <p className="mt-3 text-xs font-semibold" style={{ color: c.muted }}>Browse freely — sign in to save acts or create groups.</p>}
                </div>
              </header>

              {/* ── What's Next banner ──────────────────────────── */}
              {festivalIsActive && nextPerformance && (
                <div
                  data-testid="whats-next-banner"
                  className="whats-next-banner mb-4 fade-up"
                >
                  <span className="whats-next-label">▶ הבא שלך:</span>
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
                  style={{
                    background: `${c.danger}12`,
                    border: `1px solid ${c.danger}44`,
                    color: c.danger,
                  }}
                >
                  <span className="text-lg shrink-0">⚠</span>
                  <div className="flex-1 min-w-0">
                    <b>{conflictWarning.newPerf.artistName}</b> מתנגש עם{' '}
                    <b>{conflictWarning.existing.artistName}</b> ב-{conflictWarning.existing.stageName}
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
                style={{
                  top: 57,
                  background: `${c.bg}ee`,
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  borderBottom: `1px solid ${c.brd}`
                }}
              >
                <div className="flex items-center gap-2 overflow-x-auto scroll-hidden pb-1">
                  {(['artists', 'lineup', 'timeline', 'info'] as FestivalTab[]).map((nextTab) => {
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
                  {dayConflictCount > 0 && tab === 'timeline' && (
                    <span className="shrink-0 ml-auto rounded-full px-3 py-1.5 text-xs font-bold" style={{ background: `${c.danger}18`, color: c.danger, border: `1px solid ${c.danger}44` }}>
                      ⚠ {dayConflictCount} conflict{dayConflictCount > 1 ? 's' : ''}
                    </span>
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

              {/* ── Artists tab — alphabetical roster ─────────────── */}
              {tab === 'artists' && (
                <div data-testid="artists-tab">
                  {artistRoster.length === 0 && !loading && (
                    <p className="mt-4 text-sm" style={{ color: c.muted }}>No artists found.</p>
                  )}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                    {artistRoster.map((artist) => {
                      const isAll = artist.starState === 'all';
                      const isMixed = artist.starState === 'mixed';
                      const isAnyLive = artist.performances.some(p => nowPlayingIds.has(p.id));
                      const dayLabels = Array.from(new Set(artist.performances.map((p) => p.dayDate)))
                        .sort()
                        .map((d) => new Date(d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }));
                      return (
                        <article
                          key={artist.artistName}
                          data-testid="lineup-artist-row"
                          className="overflow-hidden rounded-2xl"
                          style={{
                            background: c.surf,
                            border: `1px solid ${isAnyLive ? '#ef444433' : isAll ? `${c.star}44` : c.brd}`,
                            boxShadow: isAnyLive ? '0 0 14px rgba(239,68,68,0.15)' : isAll ? `0 0 14px ${c.star}12` : 'none',
                          }}
                        >
                          <div className="flex items-center gap-2 px-3 py-2.5">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h3 className="truncate text-sm font-bold leading-snug" style={{ color: c.txt }}>
                                  {artist.artistName}
                                </h3>
                                {isAnyLive && <LiveBadge compact />}
                              </div>
                              <p className="text-[11px] mt-0.5 truncate" style={{ color: c.muted }}>
                                {artist.performances.length} set{artist.performances.length !== 1 ? 's' : ''}
                                {' · '}{dayLabels.join(', ')}
                              </p>
                            </div>
                            <button
                              type="button"
                              data-testid="lineup-artist-star"
                              onClick={() => toggleArtistStar(artist)}
                              aria-label={isAll ? `Unstar all sets by ${artist.artistName}` : `Star all sets by ${artist.artistName}`}
                              className="inline-flex items-center justify-center rounded-full font-black transition"
                              style={{
                                width: 36,
                                height: 36,
                                background: isAll ? c.star : isMixed ? `${c.star}55` : 'rgba(0,0,0,.38)',
                                color: isAll ? '#0f0f00' : 'rgba(255,255,255,0.9)',
                                border: `1.5px solid ${isAll || isMixed ? c.star : 'rgba(255,255,255,.22)'}`,
                                boxShadow: isAll ? `0 0 16px ${c.star}66, inset 0 1px 0 rgba(255,255,255,.2)` : 'none',
                                flexShrink: 0,
                                opacity: isMixed ? 0.75 : 1,
                                fontSize: 14,
                              }}
                            >
                              {isAll || isMixed ? '★' : '☆'}
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Lineup tab — per-performance schedule ──────────── */}
              {tab === 'lineup' && (
                <>
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
                              {renderStarButton(performance)}
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
              )}

              {/* ── Timeline tab ─────────────────────────────────── */}
              {tab === 'timeline' && (
                <section className="rounded-3xl p-4 shadow-card" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
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
                      <div style={{ minWidth: stageLabelWidth + hours.length * hourWidth }}>
                        {/* Hour header */}
                        <div className="mb-2 flex" style={{ marginLeft: stageLabelWidth }}>
                          {hours.map((hour) => {
                            const isMidnight = hour % 24 === 0 && hour !== hours[0];
                            const dateLabel = isMidnight ? new Date(refTime + hour * 36e5).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : null;
                            return (
                              <div key={hour} className="shrink-0 pl-2 text-xs font-bold relative" style={{ width: hourWidth, color: isMidnight ? c.acc : c.muted, borderLeft: `${isMidnight ? 2 : 1}px solid ${isMidnight ? c.acc : c.brd}` }}>
                                {dateLabel ? <span style={{ color: c.acc, fontWeight: 800 }}>{dateLabel}</span> : `${String(hour % 24).padStart(2, '0')}:00`}
                              </div>
                            );
                          })}
                        </div>

                        {allStages.filter((stage) => activeStages[stage.name] !== false).map((stage) => {
                          const stageItems = timelinePerformances.filter((performance) => performance.stageName === stage.name);
                          return (
                            <div key={stage.name} className="mb-2 flex items-stretch" data-testid="festival-stage-row">
                              {/* Sticky stage label */}
                              <div
                                className="shrink-0 pr-2 text-right text-xs font-bold leading-tight flex items-center justify-end"
                                style={{ width: stageLabelWidth, color: stage.color, position: 'sticky', left: 0, zIndex: 2, background: c.surf }}
                              >
                                <span className="rounded-lg px-1.5 py-0.5" style={{ background: `${stage.color}18` }}>{stage.name}</span>
                              </div>
                              <div className="relative h-14 flex-1 rounded-2xl overflow-hidden" style={{ background: `${stage.color}06`, border: `1px solid ${c.brd}` }}>
                                {/* Hour grid lines */}
                                {hours.map((hour) => {
                                  const isMidnight = hour % 24 === 0 && hour !== hours[0];
                                  return (
                                    <div key={hour} className="absolute top-0 h-full" style={{ left: (hour - minHour) * hourWidth, width: isMidnight ? 2 : 1, background: isMidnight ? `${c.acc}66` : c.brd }} />
                                  );
                                })}
                                {/* Now line */}
                                {nowLeft !== null && (
                                  <div
                                    ref={nowLineRef}
                                    className="now-line absolute top-0 h-full z-10 pointer-events-none"
                                    style={{ left: nowLeft, width: 2, background: c.danger, borderRadius: 2 }}
                                  >
                                    <span className="now-label">NOW</span>
                                  </div>
                                )}
                                {/* Performance blocks */}
                                {stageItems.map((performance) => {
                                  const left = (absHour(performance.startTime, refTime) - minHour) * hourWidth;
                                  const width = Math.max(60, durationHours(performance.startTime, performance.endTime) * hourWidth - 4);
                                  const isGoing = performance.status === 'going';
                                  const hasConflict = conflictIds.has(performance.id);
                                  const isLive = nowPlayingIds.has(performance.id);
                                  return (
                                    <div
                                      key={performance.id}
                                      data-testid="festival-performance-block"
                                      title={`${performance.artistName} · ${timeLabel(performance.startTime)}–${timeLabel(performance.endTime)}${hasConflict ? ' ⚠ Time conflict!' : ''}${isLive ? ' 🔴 LIVE' : ''}`}
                                      className={`perf-block absolute top-1.5 h-11 overflow-hidden rounded-xl text-left text-xs font-bold ${isGoing && hasConflict ? 'conflict-block' : ''}`}
                                      style={{
                                        left,
                                        width,
                                        background: c.surf2,
                                        borderLeft: `3px solid ${performance.stageColor}`,
                                        paddingLeft: 10,
                                        paddingRight: 34,
                                        color: c.txt,
                                        boxShadow: isLive
                                          ? `inset 0 0 0 2px rgba(239,68,68,0.6), 0 2px 10px rgba(239,68,68,0.2)`
                                          : isGoing
                                          ? `inset 0 0 0 1px ${performance.stageColor}44, 0 2px 10px ${performance.stageColor}33`
                                          : `inset 0 0 0 1px ${c.brd}`,
                                      }}
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

              {/* ── Go to Now floating button ────────────────────── */}
              {tab === 'timeline' && nowLeft !== null && (
                <button
                  type="button"
                  data-testid="go-to-now-btn"
                  onClick={() =>
                    nowLineRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
                  }
                  className="go-to-now-btn"
                  aria-label="Scroll to current time"
                >
                  ▶ עכשיו
                </button>
              )}

              {/* ── Info tab (About + Groups) ─────────────────────── */}
              {tab === 'info' && (
                <div className="space-y-4">
                  <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-[1fr_300px]">
                    <article className="rounded-3xl p-5" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="text-xl font-extrabold">About</h2>
                        {profile?.role === 'admin' && !editingInfo && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditDescription(festival.description || '');
                              setEditLocation(festival.location || '');
                              setEditWebsite(festival.website || '');
                              setEditingInfo(true);
                            }}
                            className="tap-active rounded-full px-3 py-1 text-xs font-bold"
                            style={{ background: c.surf2, border: `1px solid ${c.brd}`, color: c.muted }}
                          >
                            Edit
                          </button>
                        )}
                      </div>
                      {editingInfo ? (
                        <div className="space-y-3">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-xs font-semibold" style={{ color: c.muted }}>Description</label>
                              <button
                                type="button"
                                disabled={fetchingDescription}
                                onClick={async () => {
                                  setFetchingDescription(true);
                                  try {
                                    const { data: { session } } = await supabase.auth.getSession();
                                    const res = await fetch('/api/admin/fetch-festival-info', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
                                      body: JSON.stringify({ festivalId: festival.id, festivalName: festival.name }),
                                    });
                                    const json = await res.json() as { description?: string; error?: string };
                                    if (json.description) setEditDescription(json.description);
                                  } finally {
                                    setFetchingDescription(false);
                                  }
                                }}
                                className="tap-active rounded-full px-2.5 py-1 text-[11px] font-bold disabled:opacity-50"
                                style={{ background: c.surf2, border: `1px solid ${c.brd}`, color: c.muted }}
                              >
                                {fetchingDescription ? 'Fetching…' : '🔍 Fetch from Google'}
                              </button>
                            </div>
                            <textarea
                              rows={5}
                              value={editDescription}
                              onChange={(e) => setEditDescription(e.target.value)}
                              placeholder="Festival description…"
                              className="w-full rounded-2xl px-4 py-3 text-sm outline-none resize-none"
                              style={{ background: c.surf2, border: `1px solid ${c.brd}`, color: c.txt }}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-semibold" style={{ color: c.muted }}>Location</label>
                            <input
                              value={editLocation}
                              onChange={(e) => setEditLocation(e.target.value)}
                              placeholder="City, Country"
                              className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
                              style={{ background: c.surf2, border: `1px solid ${c.brd}`, color: c.txt, minHeight: 44 }}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-semibold" style={{ color: c.muted }}>Website</label>
                            <input
                              value={editWebsite}
                              onChange={(e) => setEditWebsite(e.target.value)}
                              placeholder="https://…"
                              type="url"
                              className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
                              style={{ background: c.surf2, border: `1px solid ${c.brd}`, color: c.txt, minHeight: 44 }}
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingInfo(false)}
                              className="flex-1 tap-active rounded-2xl px-4 py-2.5 text-sm font-bold"
                              style={{ background: c.surf2, border: `1px solid ${c.brd}`, color: c.muted }}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={savingInfo}
                              onClick={async () => {
                                setSavingInfo(true);
                                try {
                                  const { data: { session } } = await supabase.auth.getSession();
                                  const res = await fetch(`/api/admin/festivals/${festival.id}`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
                                    body: JSON.stringify({ description: editDescription || null, location: editLocation || null, website: editWebsite || null }),
                                  });
                                  if (res.ok) {
                                    setFestival((prev) => prev ? { ...prev, description: editDescription || null, location: editLocation || null, website: editWebsite || null } : prev);
                                    setEditingInfo(false);
                                  }
                                } finally {
                                  setSavingInfo(false);
                                }
                              }}
                              className="flex-1 tap-active rounded-2xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                              style={{ background: festival.color || c.acc }}
                            >
                              {savingInfo ? 'Saving…' : 'Save'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        festival.description
                          ? <p className="leading-7 text-sm" style={{ color: c.muted }}>{festival.description}</p>
                          : <p className="text-sm italic" style={{ color: `${c.muted}88` }}>No description yet.</p>
                      )}
                    </article>
                    <aside className="rounded-3xl p-5" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
                      <h2 className="mb-3 text-xl font-extrabold">Festival details</h2>
                      <div className="space-y-2.5 text-sm" style={{ color: c.muted }}>
                        <div><b style={{ color: c.txt }}>Location:</b> {festival.location || 'TBA'}</div>
                        <div><b style={{ color: c.txt }}>Dates:</b> {formatDateRange(festival.start_date, festival.end_date)}</div>
                        <div><b style={{ color: c.txt }}>Stages:</b> {allStages.length}</div>
                        <div><b style={{ color: c.txt }}>Days:</b> {days.length}</div>
                        <div><b style={{ color: c.txt }}>Performances:</b> {performances.length}</div>
                        {festival.website && (
                          <div>
                            <b style={{ color: c.txt }}>Website:</b>{' '}
                            <a href={festival.website} target="_blank" rel="noopener noreferrer" style={{ color: c.acc }}>{festival.website}</a>
                          </div>
                        )}
                        {festival.clashfinder_slug && <div><b style={{ color: c.txt }}>Source:</b> {festival.clashfinder_slug}</div>}
                      </div>
                    </aside>
                  </section>

                  <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-3xl p-5" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
                      <h2 className="mb-2 font-extrabold">Create a group</h2>
                      <p className="mb-4 text-sm" style={{ color: c.muted }}>Open a shared schedule and invite friends to compare picks.</p>
                      <button
                        type="button"
                        onClick={openCreateGroupModal}
                        className="tap-active rounded-2xl px-4 py-3 text-sm font-bold text-white"
                        style={{ background: festival.color || c.acc, minHeight: 48 }}
                      >
                        {user ? 'Create Group' : 'Sign in to Create Group'}
                      </button>
                    </div>
                    <form onSubmit={handleJoinGroup} className="rounded-3xl p-5" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
                      <h2 className="mb-2 font-extrabold">Join a group</h2>
                      <p className="mb-4 text-sm" style={{ color: c.muted }}>Paste an invite code from a friend.</p>
                      <div className="flex gap-2">
                        <input
                          value={inviteCode}
                          onChange={(event) => setInviteCode(event.target.value)}
                          placeholder="Invite code"
                          className="min-w-0 flex-1 rounded-2xl px-4 py-3 text-sm outline-none"
                          style={{ background: c.surf2, border: `1px solid ${c.brd}`, color: c.txt, minHeight: 48 }}
                        />
                        <button
                          type="submit"
                          className="tap-active rounded-2xl px-4 py-3 text-sm font-bold text-white"
                          style={{ background: c.acc, minHeight: 48 }}
                        >
                          {user ? 'Join' : 'Sign in'}
                        </button>
                      </div>
                      {joinError && <p className="mt-2 text-sm font-semibold" style={{ color: c.danger }}>{joinError}</p>}
                    </form>
                  </section>
                </div>
              )}

              {!loading && performances.length === 0 && <p style={{ color: c.muted }}>No active performances found.</p>}

              {/* ── Create group modal ───────────────────────────── */}
              {showCreateModal && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center p-4"
                  style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
                  onClick={() => setShowCreateModal(false)}
                >
                  <div
                    className="slide-up w-full max-w-sm rounded-[28px] p-6 shadow-elevated"
                    style={{ background: c.surf, border: `1px solid ${c.brd}` }}
                    onClick={(e) => e.stopPropagation()}
                  >
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
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </>
  );
}
