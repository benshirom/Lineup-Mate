import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/lib/AuthContext';
import { formatDateRange, getThemeColors, type ThemeMode } from '@/lib/platform';

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

export default function FestivalPage() {
  const router = useRouter();
  const { festivalId, day } = router.query;
  const { user, supabase } = useAuth();
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
  const [theme] = useState<ThemeMode>('dark');

  const c = getThemeColors(theme);

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
  const hourWidth = 118;
  const stageLabelWidth = 132;

  const renderStarButton = (performance: PerformanceItem, compact = false) => {
    const isGoing = performance.status === 'going';
    return (
      <button
        type="button"
        disabled={savingId === performance.id}
        onClick={(event) => {
          event.stopPropagation();
          updatePreference(performance.id, isGoing ? null : 'going');
        }}
        aria-label={isGoing ? 'Remove from my schedule' : 'Add to my schedule'}
        className="inline-flex items-center justify-center rounded-full font-black transition hover:scale-110 disabled:opacity-60"
        style={{
          width: compact ? 30 : 36,
          height: compact ? 30 : 36,
          background: isGoing ? '#ffd166' : 'rgba(0,0,0,.35)',
          color: isGoing ? '#1a1a10' : '#fff',
          border: `1px solid ${isGoing ? '#ffd166' : 'rgba(255,255,255,.35)'}`,
          boxShadow: isGoing ? '0 0 18px rgba(255, 209, 102, .35)' : 'none'
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
              <header className="mb-6 overflow-hidden rounded-[28px] shadow-2xl" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
                <div className="h-2" style={{ background: festival.color || c.acc }} />
                <div className="grid gap-5 p-6 lg:grid-cols-[1fr_360px] lg:items-end">
                  <div>
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-16 w-16 items-center justify-center rounded-3xl text-4xl" style={{ background: `${festival.color || c.acc}22` }}>
                        {festival.emoji || '🎪'}
                      </div>
                      <div>
                        <p className="text-xs font-extrabold uppercase tracking-widest" style={{ color: festival.color || c.acc }}>
                          {festival.genre_label || festival.genre || 'Festival'}
                        </p>
                        <h1 className="text-3xl font-black sm:text-5xl" style={{ fontFamily: 'Syne, Nunito, sans-serif' }}>
                          {festivalTitle(festival)}
                        </h1>
                      </div>
                    </div>
                    <p className="max-w-3xl text-sm leading-7 sm:text-base" style={{ color: c.muted }}>
                      {festival.description || 'Browse the lineup, save your favorite artists and plan with friends.'}
                    </p>
                    {!user && <p className="mt-3 text-sm font-bold" style={{ color: c.acc }}>Browse freely. Sign in only when you want to save acts or create groups.</p>}
                  </div>

                  <div className="rounded-3xl p-4" style={{ background: c.surf2, border: `1px solid ${c.brd}` }}>
                    <div className="space-y-2 text-sm" style={{ color: c.muted }}>
                      <div>📍 {festival.location || 'Location TBA'}</div>
                      <div>📅 {formatDateRange(festival.start_date, festival.end_date)}</div>
                      {festival.website && <div>🌐 {festival.website}</div>}
                      {festival.last_synced_at && <div>🔄 Last sync: {new Date(festival.last_synced_at).toLocaleString()}</div>}
                    </div>
                  </div>
                </div>
              </header>

              <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-3xl p-4" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
                  <h2 className="mb-2 font-black">Create a group</h2>
                  <p className="mb-4 text-sm" style={{ color: c.muted }}>Open a shared schedule and invite friends to compare picks.</p>
                  <button type="button" onClick={() => { if (!requireLogin()) return; setShowCreateModal(true); }} className="rounded-2xl px-4 py-3 text-sm font-black text-white" style={{ background: festival.color || c.acc }}>
                    {user ? 'Create Group' : 'Sign in to Create Group'}
                  </button>
                </div>

                <form onSubmit={handleJoinGroup} className="rounded-3xl p-4" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
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

              <div className="mb-5 flex flex-wrap gap-2">
                {(['timeline', 'lineup', 'info'] as FestivalTab[]).map((nextTab) => (
                  <button key={nextTab} type="button" onClick={() => setTab(nextTab)} className="rounded-full px-5 py-2 text-sm font-black capitalize" style={{ background: tab === nextTab ? festival.color || c.acc : c.surf, color: tab === nextTab ? '#fff' : c.muted, border: `1px solid ${tab === nextTab ? festival.color || c.acc : c.brd}` }}>
                    {nextTab}
                  </button>
                ))}
              </div>

              {days.length > 0 && (
                <div className="relative mb-5">
                  <div className="flex gap-2 overflow-x-auto scroll-hidden py-1 px-0.5" data-testid="festival-day-tabs" style={{ maskImage: 'linear-gradient(to right, transparent 0%, black 3%, black 97%, transparent 100%)' }}>
                    {days.map((nextDay) => (
                      <button key={nextDay} type="button" data-testid="festival-day-tab" onClick={() => selectDay(nextDay)} className="whitespace-nowrap rounded-full px-4 py-2 text-xs font-black" style={{ background: selectedDay === nextDay ? c.accB : c.surf, color: selectedDay === nextDay ? '#fff' : c.muted, border: `1px solid ${selectedDay === nextDay ? c.accB : c.brd}` }}>
                        {new Date(nextDay).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {tab === 'timeline' && (
                <section className="rounded-[28px] p-4 shadow-2xl" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
                  <div className="mb-4 flex flex-wrap gap-2" data-testid="festival-stage-filters">
                    {allStages.map((stage) => {
                      const isOn = activeStages[stage.name] !== false;
                      const hasShowsToday = selectedDayPerformances.some((performance) => performance.stageName === stage.name);
                      return (
                        <button key={stage.name} type="button" data-testid="festival-stage-filter" onClick={() => setActiveStages((current) => ({ ...current, [stage.name]: !isOn }))} className="rounded-full px-3 py-1 text-xs font-black" style={{ background: isOn ? stage.color : c.surf2, color: isOn ? '#fff' : c.muted, border: `1px solid ${isOn ? stage.color : c.brd}`, opacity: hasShowsToday ? 1 : 0.45 }} title={hasShowsToday ? stage.name : `${stage.name} has no shows on this day`}>
                          {stage.name}
                        </button>
                      );
                    })}
                  </div>

                  {visiblePerformances.length === 0 ? (
                    <p style={{ color: c.muted }}>No shows this day.</p>
                  ) : (
                    <div className="overflow-x-auto scroll-thin">
                      <div style={{ minWidth: stageLabelWidth + hours.length * hourWidth }}>
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
                            <div key={stage.name} className="mb-2 flex" data-testid="festival-stage-row">
                              <div className="shrink-0 pr-3 text-right text-xs font-black" style={{ width: stageLabelWidth, color: stage.color }}>
                                {stage.name}
                              </div>
                              <div className="relative h-16 flex-1 rounded-2xl" style={{ background: c.surf2, border: `1px solid ${c.brd}` }}>
                                {hours.map((hour) => (
                                  <div key={hour} className="absolute top-0 h-full" style={{ left: (hour - minHour) * hourWidth, width: 1, background: c.brd }} />
                                ))}
                                {stageItems.map((performance) => {
                                  const left = (hourNumber(performance.startTime) - minHour) * hourWidth;
                                  const width = Math.max(92, durationHours(performance.startTime, performance.endTime) * hourWidth - 6);
                                  return (
                                    <div key={performance.id} data-testid="festival-performance-block" title={`${performance.artistName} · ${timeLabel(performance.startTime)}-${timeLabel(performance.endTime)}`} className="absolute top-2 h-12 overflow-hidden rounded-xl px-3 pr-10 text-left text-xs font-black text-white shadow-lg" style={{ left, width, background: performance.stageColor }}>
                                      <span className="block truncate">{performance.artistName}</span>
                                      <span className="block truncate text-[10px] opacity-80">{timeLabel(performance.startTime)} – {timeLabel(performance.endTime)}</span>
                                      <span className="absolute right-2 top-1/2 -translate-y-1/2">{renderStarButton(performance, true)}</span>
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

              {tab === 'lineup' && (
                <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {visiblePerformances.map((performance) => (
                    <article key={performance.id} className="rounded-3xl p-4" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-black">{performance.artistName}</h3>
                          <p className="text-xs" style={{ color: performance.stageColor }}>{performance.stageName}</p>
                        </div>
                        {renderStarButton(performance)}
                      </div>
                      <p className="text-sm" style={{ color: c.muted }}>{timeLabel(performance.startTime)} – {timeLabel(performance.endTime)}</p>
                    </article>
                  ))}
                </section>
              )}

              {tab === 'info' && (
                <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
                  <article className="rounded-3xl p-5" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
                    <h2 className="mb-3 text-xl font-black">About</h2>
                    <p className="leading-8" style={{ color: c.muted }}>{festival.description || 'No description yet.'}</p>
                  </article>
                  <aside className="rounded-3xl p-5" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
                    <h2 className="mb-3 text-xl font-black">Festival details</h2>
                    <div className="space-y-3 text-sm" style={{ color: c.muted }}>
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
