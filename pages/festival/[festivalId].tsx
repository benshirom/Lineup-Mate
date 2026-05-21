import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState } from 'react';
import Navbar from '@/components/Navbar';
import Seo from '@/components/Seo';
import { useAuth } from '@/lib/AuthContext';
import { formatDateRange, getThemeColors } from '@/lib/platform';

type PreferenceStatus = 'going' | 'maybe' | 'not_interested';
type FestivalTab = 'artists' | 'timeline' | 'info';

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

function festivalSeoDescription(festival: Festival, performanceCount: number, stageCount: number, dayCount: number) {
  const location = festival.location ? ` in ${festival.location}` : '';
  const stats = performanceCount > 0
    ? `${performanceCount} performances across ${stageCount} stages and ${dayCount} days`
    : 'lineup, stages, dates and personal planning tools';
  return `${festivalTitle(festival)} schedule${location}: explore ${stats}, save your must-see artists, and plan with your crew on Lineup·Mate.`;
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
      const todayStr = now.toLocaleDateString('sv');
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
  const [tab, setTab] = useState<FestivalTab>('artists');
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

  const openCreateGroupModal = () => {
    if (!requireLogin()) return;
    setGroupNameInput(festival ? `${festival.name} Group` : '');
    setShowCreateModal(true);
  };

  const minHour = hours[0] || 0;
  const nowLeft = useNowLine(hours, minHour, hourWidth, selectedDay);

  const conflictIds = useMemo(() => detectConflicts(performances), [performances]);
  const dayConflictCount = useMemo(
    () => selectedDayPerformances.filter((p) => conflictIds.has(p.id)).length,
    [selectedDayPerformances, conflictIds]
  );

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
      {festival && (
        <Seo
          title={`${festivalTitle(festival)} lineup planner | Lineup·Mate`}
          description={festivalSeoDescription(festival, performances.length, allStages.length, days.length)}
          canonicalPath={`/festival/${festival.id}`}
        />
      )}
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
                  {(['artists', 'timeline', 'info'] as FestivalTab[]).map((nextTab) => {
                    const tabLabel = nextTab === 'artists' ? 'Artists' : nextTab === 'timeline' ? 'Timeline' : 'Info';
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

              {/* ── Artists tab (default) ─────────────────────────── */}
              {tab === 'artists' && (
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