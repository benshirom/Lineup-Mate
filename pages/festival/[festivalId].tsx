import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/lib/AuthContext';
import { formatDateRange, getThemeColors } from '@/lib/platform';

type FestivalTab = 'lineup' | 'timeline' | 'info';

type PreferenceStatus = 'going' | 'maybe' | null;

interface Festival {
  id: number;
  name: string;
  year: number;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  description?: string | null;
  website?: string | null;
  color?: string | null;
  genre?: string | null;
  genre_label?: string | null;
  clashfinder_slug?: string | null;
}

interface PerformanceItem {
  id: number;
  artistName: string;
  stageName: string;
  stageColor: string;
  startTime: string;
  endTime: string;
  dayDate: string;
  status: PreferenceStatus;
}

function timeLabel(dateString: string) {
  return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function dayLabel(dateString: string) {
  return new Date(dateString).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

function festivalTitle(festival: Festival) {
  return festival.name.includes(String(festival.year)) ? festival.name : `${festival.name} ${festival.year}`;
}

function detectConflicts(performances: PerformanceItem[]) {
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

export default function FestivalPage() {
  const router = useRouter();
  const { festivalId, day } = router.query;
  const { user, supabase, theme } = useAuth();
  const c = getThemeColors(theme);

  const [festival, setFestival] = useState<Festival | null>(null);
  const [performances, setPerformances] = useState<PerformanceItem[]>([]);
  const [days, setDays] = useState<string[]>([]);
  const [selectedDay, setSelectedDay] = useState('');
  const [activeStages, setActiveStages] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<FestivalTab>('lineup');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [popId, setPopId] = useState<number | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    if (!festivalId) return;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: festivalData, error: festivalError } = await supabase.from('festivals').select('*').eq('id', festivalId).single();
        if (festivalError) throw festivalError;
        setFestival(festivalData as Festival);

        const { data: rows, error: perfError } = await supabase
          .from('performances')
          .select('id, start_time, end_time, day_date, stages(name, color), artists(name)')
          .eq('festival_id', festivalId)
          .eq('is_active', true)
          .order('start_time');
        if (perfError) throw perfError;

        const prefMap: Record<number, PreferenceStatus> = {};
        if (user) {
          const { data: prefs, error: prefsError } = await supabase.from('user_performance_preferences').select('performance_id,status').eq('user_id', user.id);
          if (prefsError) throw prefsError;
          prefs?.forEach((pref) => { prefMap[pref.performance_id] = pref.status === 'going' || pref.status === 'maybe' ? pref.status : null; });
        }

        const mapped: PerformanceItem[] = (rows || []).map((row: any) => ({
          id: row.id,
          artistName: row.artists?.name || 'Unknown Artist',
          stageName: row.stages?.name || 'Stage',
          stageColor: row.stages?.color || festivalData?.color || c.secondary,
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
  }, [festivalId, supabase, user, day, c.secondary]);

  const selectedDayPerformances = useMemo(() => performances.filter((performance) => performance.dayDate === selectedDay), [performances, selectedDay]);
  const visiblePerformances = useMemo(() => selectedDayPerformances.filter((performance) => activeStages[performance.stageName] !== false), [selectedDayPerformances, activeStages]);
  const allStages = useMemo(() => {
    const stageMap = new Map<string, string>();
    performances.forEach((performance) => stageMap.set(performance.stageName, performance.stageColor));
    return Array.from(stageMap.entries()).map(([name, color]) => ({ name, color }));
  }, [performances]);
  const conflictIds = useMemo(() => detectConflicts(performances), [performances]);

  const selectDay = (nextDay: string) => {
    setSelectedDay(nextDay);
    if (festivalId) router.replace(`/festival/${festivalId}?day=${nextDay}`, undefined, { shallow: true });
  };

  const requireLogin = () => {
    if (!user) {
      router.push('/login');
      return false;
    }
    return true;
  };

  const updatePreference = async (performanceId: number, status: PreferenceStatus) => {
    if (!requireLogin()) return;
    setSavingId(performanceId);
    setPopId(performanceId);
    setTimeout(() => setPopId(null), 280);
    try {
      const { error: rpcError } = await supabase.rpc('upsert_user_preference', { p_user_id: user!.id, p_performance_id: performanceId, p_status: status });
      if (rpcError) throw rpcError;
      setPerformances((current) => current.map((performance) => performance.id === performanceId ? { ...performance, status } : performance));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save your preference.');
    } finally {
      setSavingId(null);
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
      const { data: joinedGroupId, error: rpcError } = await supabase.rpc('join_group_by_invite_code', { p_invite_code: inviteCode.trim().toLowerCase() });
      if (rpcError) throw rpcError;
      router.push(`/group/${joinedGroupId}`);
    } catch (err: unknown) {
      setJoinError(err instanceof Error ? err.message : 'Could not join group.');
    }
  };

  const createGroupFromFestival = async () => {
    if (!festival || !requireLogin()) return;
    const { data: newGroup, error: groupError } = await supabase.from('groups').insert({ festival_id: festival.id, name: `${festival.name} Group`, owner_user_id: user!.id }).select().single();
    if (groupError) { setError(groupError.message); return; }
    await supabase.from('group_members').insert({ group_id: newGroup.id, user_id: user!.id, role: 'owner' });
    router.push(`/group/${newGroup.id}`);
  };

  const renderStarButton = (performance: PerformanceItem) => {
    const isGoing = performance.status === 'going';
    return <button type="button" disabled={savingId === performance.id} onClick={(event) => { event.stopPropagation(); updatePreference(performance.id, isGoing ? null : 'going'); }} aria-label={isGoing ? 'Remove from my schedule' : 'Add to my schedule'} className={`mobile-action inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg font-black transition disabled:opacity-60 ${popId === performance.id ? 'star-pop' : ''}`} style={{ background: isGoing ? 'rgba(250,204,21,0.14)' : c.surfaceHover, color: isGoing ? c.star : c.muted, border: `1px solid ${isGoing ? 'rgba(250,204,21,0.32)' : c.border}` }}>{isGoing ? '★' : '☆'}</button>;
  };

  const renderPerformanceCard = (performance: PerformanceItem) => {
    const hasConflict = performance.status === 'going' && conflictIds.has(performance.id);
    return (
      <article key={performance.id} data-testid="festival-performance-block" className="premium-card p-4" style={{ borderLeft: `4px solid ${performance.stageColor}` }}>
        <div className="relative z-10 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2"><span className="rounded-full px-2.5 py-1 text-[10px] font-black" style={{ background: c.secondarySoft, color: c.secondary, border: '1px solid rgba(6,182,212,0.24)' }}>{timeLabel(performance.startTime)} – {timeLabel(performance.endTime)}</span><span className="rounded-full px-2.5 py-1 text-[10px] font-black" style={{ background: c.surfaceHover, color: c.muted, border: `1px solid ${c.border}` }}>{performance.stageName}</span>{hasConflict && <span className="rounded-full px-2.5 py-1 text-[10px] font-black" style={{ background: 'rgba(239,68,68,0.12)', color: c.danger, border: '1px solid rgba(239,68,68,0.26)' }}>Conflict</span>}</div>
            <h3 className="app-title truncate text-xl font-black">{performance.artistName}</h3>
            <p className="mt-1 text-sm" style={{ color: c.muted }}>{dayLabel(performance.dayDate)}</p>
          </div>
          {renderStarButton(performance)}
        </div>
      </article>
    );
  };

  return (
    <>
      <Navbar />
      <main className="mobile-shell-padding" style={{ minHeight: '100vh', background: c.bg, color: c.txt }}>
        <section className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10">
          {loading && <p style={{ color: c.muted }}>Loading lineup…</p>}
          {error && <p className="mb-4 rounded-2xl p-4 text-sm font-bold" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.26)', color: c.danger }}>{error}</p>}

          {festival && (
            <>
              <header className="premium-card mb-6 p-5 sm:p-6"><div className="relative z-10 grid gap-5 lg:grid-cols-[1fr_320px] lg:items-center"><div><p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: c.primary }}>{festival.genre_label || festival.genre || 'Festival'}</p><h1 className="app-title mt-2 text-4xl font-black leading-tight sm:text-6xl">{festivalTitle(festival)}</h1>{!user && <p className="mt-3 text-sm" style={{ color: c.textSecondary }}>Browse freely — sign in to save acts and create groups.</p>}</div><div className="rounded-2xl p-4 text-sm" style={{ background: c.surfaceHover, border: `1px solid ${c.border}`, color: c.muted }}><div className="space-y-1.5"><div>{festival.location || 'Location TBA'}</div><div>{formatDateRange(festival.start_date, festival.end_date)}</div><div><b style={{ color: c.txt }}>{performances.length}</b> acts · <b style={{ color: c.txt }}>{allStages.length}</b> stages · <b style={{ color: c.txt }}>{days.length}</b> days</div></div></div></div></header>

              <div className="sticky z-30 -mx-4 mb-5 px-4 py-3 md:-mx-6 md:px-6" style={{ top: 65, background: 'rgba(8,11,18,0.92)', borderBottom: `1px solid ${c.border}`, backdropFilter: 'blur(16px)' }}>
                <div className="flex gap-2 overflow-x-auto scroll-hidden pb-2">{([['lineup', 'Artists'], ['timeline', 'Timeline'], ['info', 'Info']] as Array<[FestivalTab, string]>).map(([nextTab, label]) => <button key={nextTab} type="button" onClick={() => setTab(nextTab)} className="mobile-action shrink-0 rounded-full px-5 py-2 text-sm font-black" style={{ background: tab === nextTab ? c.primarySoft : c.surface, color: tab === nextTab ? c.primary : c.muted, border: `1px solid ${tab === nextTab ? 'rgba(139,92,246,0.28)' : c.border}` }}>{label}</button>)}</div>
                {days.length > 0 && tab !== 'info' && <div className="flex gap-2 overflow-x-auto scroll-hidden pt-1" data-testid="festival-day-tabs">{days.map((nextDay) => <button key={nextDay} type="button" data-testid="festival-day-tab" onClick={() => selectDay(nextDay)} className="mobile-action shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-xs font-black" style={{ background: selectedDay === nextDay ? c.secondarySoft : c.surface, color: selectedDay === nextDay ? c.secondary : c.muted, border: `1px solid ${selectedDay === nextDay ? 'rgba(6,182,212,0.28)' : c.border}` }}>{new Date(nextDay).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</button>)}</div>}
              </div>

              {tab !== 'info' && <div className="mb-5 flex gap-2 overflow-x-auto scroll-hidden pb-1" data-testid="festival-stage-filters">{allStages.map((stage) => { const isOn = activeStages[stage.name] !== false; const hasShowsToday = selectedDayPerformances.some((performance) => performance.stageName === stage.name); return <button key={stage.name} type="button" data-testid="festival-stage-filter" onClick={() => setActiveStages((current) => ({ ...current, [stage.name]: !isOn }))} className="mobile-action shrink-0 rounded-full px-3 py-2 text-xs font-black" style={{ background: isOn ? c.secondarySoft : c.surface, color: isOn ? c.secondary : c.muted, border: `1px solid ${isOn ? 'rgba(6,182,212,0.28)' : c.border}`, opacity: hasShowsToday ? 1 : 0.45 }}>{stage.name}</button>; })}</div>}

              {tab === 'lineup' && <section className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">{visiblePerformances.map(renderPerformanceCard)}{visiblePerformances.length === 0 && <p className="rounded-2xl p-4 text-sm" style={{ background: c.surface, color: c.muted, border: `1px solid ${c.border}` }}>No shows this day with the selected stage filters.</p>}</section>}
              {tab === 'timeline' && <section className="premium-card p-5"><div className="relative z-10"><h2 className="app-title text-2xl font-black">Timeline</h2><p className="mt-2 text-sm" style={{ color: c.muted }}>Timeline is now a secondary compact view. Artists is the primary mobile experience.</p><div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">{visiblePerformances.map(renderPerformanceCard)}</div></div></section>}
              {tab === 'info' && <div className="grid grid-cols-1 gap-4 lg:grid-cols-2"><article className="premium-card p-5"><div className="relative z-10"><h2 className="app-title mb-3 text-2xl font-black">About</h2><p className="text-sm leading-7" style={{ color: c.muted }}>{festival.description || 'No description yet.'}</p></div></article><aside className="premium-card p-5"><div className="relative z-10"><h2 className="app-title mb-3 text-2xl font-black">Plan with friends</h2><button type="button" onClick={createGroupFromFestival} className="mobile-action mb-3 w-full rounded-2xl px-4 py-3 text-sm font-black text-white" style={{ background: `linear-gradient(135deg, ${c.primary}, ${c.secondary})` }}>{user ? 'Create Group' : 'Sign in to Create Group'}</button><form onSubmit={handleJoinGroup} className="space-y-2"><input value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} placeholder="Invite code" className="mobile-action w-full rounded-2xl px-4 py-3 text-sm outline-none" style={{ background: c.surfaceHover, border: `1px solid ${c.border}`, color: c.txt }} /><button type="submit" className="mobile-action w-full rounded-2xl px-4 py-3 text-sm font-black" style={{ background: c.surfaceHover, border: `1px solid ${c.border}`, color: c.txt }}>{user ? 'Join group' : 'Sign in'}</button></form>{joinError && <p className="mt-2 text-sm" style={{ color: c.danger }}>{joinError}</p>}</div></aside></div>}
            </>
          )}
        </section>
      </main>
    </>
  );
}
