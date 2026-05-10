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

export default function FestivalPage() {
  const router = useRouter();
  const { festivalId } = router.query;
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

        setPerformances(mapped);
        setDays(nextDays);
        setSelectedDay((current) => current || nextDays[0] || '');
        setActiveStages(Object.fromEntries(nextStages.map((stage) => [stage, true])));
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Could not load festival data.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [festivalId, supabase, user]);

  const selectedDayPerformances = useMemo(() => {
    return performances.filter((performance) => performance.dayDate === selectedDay);
  }, [performances, selectedDay]);

  const visiblePerformances = useMemo(() => {
    return selectedDayPerformances.filter((performance) => activeStages[performance.stageName] !== false);
  }, [selectedDayPerformances, activeStages]);

  const stages = useMemo(() => {
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

  const handleCreateGroup = async () => {
    if (!festival || !requireLogin()) return;

    const groupName = window.prompt('Enter a name for your group');
    if (!groupName?.trim()) return;

    setCreatingGroup(true);
    setError(null);

    try {
      const { data: newGroup, error: groupError } = await supabase
        .from('groups')
        .insert({ festival_id: festival.id, name: groupName.trim(), owner_user_id: user!.id })
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
                          {festival.name} {festival.year}
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
                  <button
                    type="button"
                    disabled={creatingGroup}
                    onClick={handleCreateGroup}
                    className="rounded-2xl px-4 py-3 text-sm font-black text-white disabled:opacity-60"
                    style={{ background: festival.color || c.acc }}
                  >
                    {creatingGroup ? 'Creating…' : user ? 'Create Group' : 'Sign in to Create Group'}
                  </button>
                </div>

                <form onSubmit={handleJoinGroup} className="rounded-3xl p-4" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
                  <h2 className="mb-2 font-black">Join a group</h2>
                  <p className="mb-4 text-sm" style={{ color: c.muted }}>Paste an invite code from a friend.</p>
                  <div className="flex gap-2">
                    <input
                      value={inviteCode}
                      onChange={(event) => setInviteCode(event.target.value)}
                      placeholder="Invite code"
                      className="min-w-0 flex-1 rounded-2xl px-4 py-3 text-sm outline-none"
                      style={{ background: c.surf2, border: `1px solid ${c.brd}`, color: c.txt }}
                    />
                    <button type="submit" className="rounded-2xl px-4 py-3 text-sm font-black text-white" style={{ background: c.accB }}>
                      {user ? 'Join' : 'Sign in'}
                    </button>
                  </div>
                  {joinError && <p className="mt-2 text-sm text-red-500">{joinError}</p>}
                </form>
              </section>

              <div className="mb-5 flex flex-wrap gap-2">
                {(['timeline', 'lineup', 'info'] as FestivalTab[]).map((nextTab) => (
                  <button
                    key={nextTab}
                    type="button"
                    onClick={() => setTab(nextTab)}
                    className="rounded-full px-5 py-2 text-sm font-black capitalize"
                    style={{
                      background: tab === nextTab ? festival.color || c.acc : c.surf,
                      color: tab === nextTab ? '#fff' : c.muted,
                      border: `1px solid ${tab === nextTab ? festival.color || c.acc : c.brd}`
                    }}
                  >
                    {nextTab}
                  </button>
                ))}
              </div>

              {days.length > 0 && (
                <div className="mb-5 flex gap-2 overflow-x-auto pb-2">
                  {days.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setSelectedDay(day)}
                      className="whitespace-nowrap rounded-full px-4 py-2 text-xs font-black"
                      style={{
                        background: selectedDay === day ? c.accB : c.surf,
                        color: selectedDay === day ? '#fff' : c.muted,
                        border: `1px solid ${selectedDay === day ? c.accB : c.brd}`
                      }}
                    >
                      {new Date(day).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                    </button>
                  ))}
                </div>
              )}

              {tab === 'timeline' && (
                <section className="rounded-[28px] p-4 shadow-2xl" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
                  <div className="mb-4 flex flex-wrap gap-2">
                    {stages.map((stage) => {
                      const isOn = activeStages[stage.name] !== false;
                      return (
                        <button
                          key={stage.name}
                          type="button"
                          onClick={() => setActiveStages((current) => ({ ...current, [stage.name]: !isOn }))}
                          className="rounded-full px-3 py-1 text-xs font-black"
                          style={{
                            background: isOn ? stage.color : c.surf2,
                            color: isOn ? '#fff' : c.muted,
                            border: `1px solid ${isOn ? stage.color : c.brd}`
                          }}
                        >
                          {stage.name}
                        </button>
                      );
                    })}
                  </div>

                  {visiblePerformances.length === 0 ? (
                    <p style={{ color: c.muted }}>No shows this day.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <div style={{ minWidth: stageLabelWidth + hours.length * hourWidth }}>
                        <div className="mb-2 flex" style={{ marginLeft: stageLabelWidth }}>
                          {hours.map((hour) => (
                            <div key={hour} className="shrink-0 pl-2 text-xs font-bold" style={{ width: hourWidth, color: c.muted, borderLeft: `1px solid ${c.brd}` }}>
                              {`${String(hour % 24).padStart(2, '0')}:00`}
                            </div>
                          ))}
                        </div>

                        {stages.filter((stage) => activeStages[stage.name] !== false).map((stage) => {
                          const stageItems = visiblePerformances.filter((performance) => performance.stageName === stage.name);
                          return (
                            <div key={stage.name} className="mb-2 flex">
                              <div className="shrink-0 pr-3 text-right text-xs font-black" style={{ width: stageLabelWidth, color: stage.color }}>
                                {stage.name}
                              </div>
                              <div className="relative h-16 flex-1 rounded-2xl" style={{ background: c.surf2, border: `1px solid ${c.brd}` }}>
                                {hours.map((hour) => (
                                  <div key={hour} className="absolute top-0 h-full" style={{ left: (hour - minHour) * hourWidth, width: 1, background: c.brd }} />
                                ))}
                                {stageItems.map((performance) => {
                                  const left = (hourNumber(performance.startTime) - minHour) * hourWidth;
                                  const width = Math.max(86, durationHours(performance.startTime, performance.endTime) * hourWidth - 6);
                                  const isGoing = performance.status === 'going';
                                  const isMaybe = performance.status === 'maybe';
                                  return (
                                    <button
                                      key={performance.id}
                                      type="button"
                                      disabled={savingId === performance.id}
                                      onClick={() => updatePreference(performance.id, isGoing ? null : 'going')}
                                      title={`${performance.artistName} · ${timeLabel(performance.startTime)}-${timeLabel(performance.endTime)}`}
                                      className="absolute top-2 h-12 overflow-hidden rounded-xl px-3 text-left text-xs font-black text-white shadow-lg transition hover:scale-[1.02] disabled:opacity-60"
                                      style={{ left, width, background: isGoing ? '#18a87a' : isMaybe ? '#d4a017' : performance.stageColor }}
                                    >
                                      <span className="block truncate">{isGoing ? '★ ' : ''}{performance.artistName}</span>
                                      <span className="block truncate text-[10px] opacity-80">{timeLabel(performance.startTime)} – {timeLabel(performance.endTime)}</span>
                                    </button>
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
                        <button
                          type="button"
                          onClick={() => updatePreference(performance.id, performance.status === 'going' ? null : 'going')}
                          className="rounded-full px-3 py-1 text-xs font-black"
                          style={{ background: performance.status === 'going' ? '#18a87a' : c.surf2, color: performance.status === 'going' ? '#fff' : c.muted, border: `1px solid ${performance.status === 'going' ? '#18a87a' : c.brd}` }}
                        >
                          {performance.status === 'going' ? '★ Going' : '☆ Save'}
                        </button>
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
                      <div><b style={{ color: c.txt }}>Stages:</b> {stages.length}</div>
                      <div><b style={{ color: c.txt }}>Performances:</b> {performances.length}</div>
                      {festival.website && <div><b style={{ color: c.txt }}>Website:</b> {festival.website}</div>}
                      {festival.clashfinder_slug && <div><b style={{ color: c.txt }}>Source:</b> {festival.clashfinder_slug}</div>}
                    </div>
                  </aside>
                </section>
              )}

              {!loading && performances.length === 0 && <p style={{ color: c.muted }}>No active performances found.</p>}
            </>
          )}
        </section>
      </main>
    </>
  );
}
