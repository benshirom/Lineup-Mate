import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/lib/AuthContext';
import { formatDateRange, getThemeColors } from '@/lib/platform';

interface Profile {
  display_name?: string | null;
  email?: string | null;
}

interface GroupMember {
  user_id: string;
  role: 'owner' | 'member';
  profile?: Profile | null;
}

interface GroupMemberPref {
  performance_id: number;
  status: string;
  user_id: string;
  user_label: string;
}

interface PerformanceInfo {
  id: number;
  artist_name: string;
  stage_name: string;
  stage_color: string;
  start_time: string;
  end_time: string;
  day_date: string;
}

interface FestivalInfo {
  id: number;
  name: string;
  year: number;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  description?: string | null;
  emoji?: string | null;
  color?: string | null;
  genre?: string | null;
  genre_label?: string | null;
  website?: string | null;
}

interface GroupData {
  id: number;
  name: string;
  invite_code: string;
  festival_id: number;
  festival?: FestivalInfo | null;
}

function memberLabel(member: GroupMember): string {
  if (member.profile?.display_name) return member.profile.display_name;
  if (member.profile?.email) return member.profile.email.split('@')[0];
  return `User·${member.user_id.slice(0, 6)}`;
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

function festivalTitle(festival: FestivalInfo) {
  return festival.name.includes(String(festival.year)) ? festival.name : `${festival.name} ${festival.year}`;
}

function statusLabel(status: string) {
  if (status === 'going') return '★';
  if (status === 'maybe') return '?';
  return '×';
}

export default function GroupPage() {
  const router = useRouter();
  const { groupId } = router.query;
  const { user, supabase } = useAuth();
  const c = getThemeColors('dark');

  const [group, setGroup] = useState<GroupData | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [performancePrefs, setPerformancePrefs] = useState<GroupMemberPref[]>([]);
  const [performances, setPerformances] = useState<Record<number, PerformanceInfo>>({});
  const [selectedDay, setSelectedDay] = useState('');
  const [activeStages, setActiveStages] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<'timeline' | 'list'>('timeline');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) { router.push('/login'); return; }
    if (!groupId) return;

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: groupData, error: groupError } = await supabase
          .from('groups')
          .select('id, name, invite_code, festival_id, festivals(id, name, year, location, start_date, end_date, description, emoji, color, genre, genre_label, website)')
          .eq('id', groupId)
          .single();

        if (groupError) throw groupError;

        const mappedGroup: GroupData = {
          id: groupData.id,
          name: groupData.name,
          invite_code: groupData.invite_code,
          festival_id: groupData.festival_id,
          festival: (groupData as any).festivals ?? null
        };
        setGroup(mappedGroup);

        const { data: memberData, error: membersError } = await supabase
          .from('group_members')
          .select('user_id, role')
          .eq('group_id', groupId);

        if (membersError) throw membersError;

        const rawMembers = (memberData ?? []) as Array<{ user_id: string; role: 'owner' | 'member' }>;
        const memberIds = rawMembers.map((m) => m.user_id);

        let profilesById: Record<string, Profile> = {};
        if (memberIds.length > 0) {
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('id, display_name, email')
            .in('id', memberIds);

          if (profilesError) throw profilesError;

          profilesById = Object.fromEntries(
            (profilesData ?? []).map((p: any) => [p.id, { display_name: p.display_name, email: p.email }])
          );
        }

        const memberList: GroupMember[] = rawMembers.map((m) => ({
          ...m,
          profile: profilesById[m.user_id] ?? null
        }));

        setMembers(memberList);

        if (memberIds.length === 0) {
          setPerformancePrefs([]);
          setPerformances({});
          return;
        }

        const { data: prefs, error: prefsError } = await supabase
          .from('user_performance_preferences')
          .select('performance_id, status, user_id')
          .in('user_id', memberIds)
          .neq('status', null);

        if (prefsError) throw prefsError;

        const prefWithLabel: GroupMemberPref[] = (prefs ?? []).map((p: any) => {
          const match = memberList.find((m) => m.user_id === p.user_id);
          return {
            performance_id: p.performance_id,
            status: p.status,
            user_id: p.user_id,
            user_label: match ? memberLabel(match) : `User·${p.user_id.slice(0, 6)}`
          };
        });

        setPerformancePrefs(prefWithLabel);

        const uniquePerfIds = Array.from(new Set((prefs ?? []).map((p: any) => p.performance_id)));
        if (uniquePerfIds.length === 0) { setPerformances({}); return; }

        const { data: perfData, error: perfError } = await supabase
          .from('performances')
          .select('id, start_time, end_time, day_date, stages(name, color), artists(name)')
          .in('id', uniquePerfIds)
          .eq('is_active', true)
          .order('start_time');

        if (perfError) throw perfError;

        const perfMap: Record<number, PerformanceInfo> = {};
        perfData?.forEach((p: any) => {
          perfMap[p.id] = {
            id: p.id,
            artist_name: p.artists?.name ?? '',
            stage_name: p.stages?.name ?? 'Stage',
            stage_color: p.stages?.color ?? mappedGroup.festival?.color ?? c.acc,
            start_time: p.start_time,
            end_time: p.end_time,
            day_date: p.day_date
          };
        });
        setPerformances(perfMap);

        const loadedPerformances = Object.values(perfMap);
        const nextDays = Array.from(new Set(loadedPerformances.map((performance) => performance.day_date))).sort();
        const nextStages = Array.from(new Set(loadedPerformances.map((performance) => performance.stage_name)));
        setSelectedDay(nextDays[0] ?? '');
        setActiveStages(Object.fromEntries(nextStages.map((stage) => [stage, true])));
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Could not load group schedule.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [groupId, supabase, user, router, c.acc]);

  const performancePreferenceMap = useMemo(() => {
    const result: Record<number, GroupMemberPref[]> = {};
    performancePrefs.forEach((pref) => {
      if (!performances[pref.performance_id]) return;
      if (!result[pref.performance_id]) result[pref.performance_id] = [];
      result[pref.performance_id].push(pref);
    });
    return result;
  }, [performancePrefs, performances]);

  const selectedDayPerformances = useMemo(() => {
    return Object.values(performances)
      .filter((performance) => performance.day_date === selectedDay)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [performances, selectedDay]);

  const visiblePerformances = useMemo(() => {
    return selectedDayPerformances.filter((performance) => activeStages[performance.stage_name] !== false);
  }, [selectedDayPerformances, activeStages]);

  const days = useMemo(() => Array.from(new Set(Object.values(performances).map((p) => p.day_date))).sort(), [performances]);
  const allStages = useMemo(() => {
    const stageMap = new Map<string, string>();
    Object.values(performances).forEach((performance) => stageMap.set(performance.stage_name, performance.stage_color));
    return Array.from(stageMap.entries()).map(([name, color]) => ({ name, color }));
  }, [performances]);

  const dayStages = useMemo(() => {
    const stageMap = new Map<string, string>();
    selectedDayPerformances.forEach((performance) => stageMap.set(performance.stage_name, performance.stage_color));
    return Array.from(stageMap.entries()).map(([name, color]) => ({ name, color }));
  }, [selectedDayPerformances]);

  const hours = useMemo(() => {
    if (visiblePerformances.length === 0) return Array.from({ length: 8 }, (_, index) => index);
    const min = Math.floor(Math.min(...visiblePerformances.map((performance) => hourNumber(performance.start_time))));
    const max = Math.ceil(Math.max(...visiblePerformances.map((performance) => hourNumber(performance.end_time))));
    return Array.from({ length: Math.max(1, max - min) }, (_, index) => min + index);
  }, [visiblePerformances]);

  const sortedListPerformances = useMemo(() => {
    return Object.values(performances).sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [performances]);

  const copyInviteCode = async () => {
    if (!group?.invite_code) return;
    await navigator.clipboard.writeText(group.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const minHour = hours[0] || 0;
  const hourWidth = 118;
  const stageLabelWidth = 132;

  const renderPeoplePills = (performanceId: number) => {
    const prefs = performancePreferenceMap[performanceId] ?? [];
    if (prefs.length === 0) return <span className="text-xs" style={{ color: c.muted }}>No picks</span>;

    return (
      <div className="flex flex-wrap gap-1" data-testid="group-performance-picks">
        {prefs.map((pref) => (
          <span
            key={`${pref.user_id}-${pref.status}`}
            className="rounded-full px-2 py-1 text-[10px] font-black"
            style={{
              background: pref.status === 'going' ? '#ffd16622' : `${c.accB}22`,
              color: pref.status === 'going' ? '#ffd166' : c.accB,
              border: `1px solid ${pref.status === 'going' ? '#ffd16655' : `${c.accB}55`}`
            }}
            title={`${pref.user_label} · ${pref.status}`}
          >
            {statusLabel(pref.status)} {pref.user_label}
          </span>
        ))}
      </div>
    );
  };

  return (
    <>
      <Navbar />
      <main style={{ minHeight: '100vh', background: c.bg, color: c.txt }}>
        <section className="mx-auto max-w-7xl px-4 py-8">
          <header className="mb-6 overflow-hidden rounded-[28px] shadow-2xl" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
            <div className="h-2" style={{ background: group?.festival?.color || c.acc }} />
            <div className="grid gap-5 p-6 lg:grid-cols-[1fr_360px] lg:items-end">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest" style={{ color: group?.festival?.color || c.acc }}>
                  Group Schedule
                </p>
                <h1 className="text-3xl font-black sm:text-5xl" style={{ fontFamily: 'Syne, Nunito, sans-serif' }}>
                  {group ? group.name : 'Loading…'}
                </h1>
                {group?.festival && (
                  <p className="mt-2 text-sm" style={{ color: c.muted }}>
                    {festivalTitle(group.festival)} · {formatDateRange(group.festival.start_date, group.festival.end_date)}
                  </p>
                )}
              </div>

              <div className="rounded-3xl p-4" style={{ background: c.surf2, border: `1px solid ${c.brd}` }}>
                <div className="space-y-2 text-sm" style={{ color: c.muted }}>
                  <div>👥 {members.length} members</div>
                  {group?.festival && <div>📍 {group.festival.location || 'Location TBA'}</div>}
                  {group?.festival && <div>📅 {formatDateRange(group.festival.start_date, group.festival.end_date)}</div>}
                  <button
                    type="button"
                    onClick={() => router.push('/groups')}
                    className="mt-2 rounded-full px-4 py-2 text-sm font-black"
                    style={{ background: c.surf, border: `1px solid ${c.brd}`, color: c.txt }}
                  >
                    ← My Groups
                  </button>
                </div>
              </div>
            </div>
          </header>

          {loading && <p style={{ color: c.muted }}>Loading group schedule…</p>}
          {error && (
            <p className="mb-4 rounded-2xl p-4 text-sm font-bold" style={{ background: '#dc262620', color: '#ef4444', border: '1px solid #dc262640' }}>
              {error}
            </p>
          )}

          {!loading && group && (
            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-[28px] p-5" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
                <h2 className="mb-1 font-black">Invite friends</h2>
                <p className="mb-4 text-sm" style={{ color: c.muted }}>Share this code so friends can join from the festival page.</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-2xl px-4 py-3 text-sm font-black" style={{ background: c.surf2, color: c.txt, border: `1px solid ${c.brd}` }}>
                    {group.invite_code}
                  </code>
                  <button type="button" onClick={copyInviteCode} className="rounded-full px-4 py-3 text-sm font-black text-white" style={{ background: copied ? '#16a34a' : c.accB }}>
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="rounded-[28px] p-5" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
                <h2 className="mb-3 font-black">Members ({members.length})</h2>
                {members.length === 0 ? (
                  <p className="text-sm" style={{ color: c.muted }}>No members yet.</p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {members.map((member) => (
                      <li key={member.user_id} className="flex items-center gap-2 rounded-full px-3 py-2" style={{ background: c.surf2 }} data-testid="group-member-pill">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-black" style={{ background: `${c.acc}33`, color: c.acc }}>
                          {memberLabel(member).slice(0, 1).toUpperCase()}
                        </span>
                        <span className="text-sm font-bold">{memberLabel(member)}</span>
                        <span className="text-[10px] font-black uppercase" style={{ color: c.muted }}>{member.role}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {!loading && !error && sortedListPerformances.length === 0 && (
            <div className="rounded-[28px] p-8 text-center" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
              <div className="text-5xl">🎶</div>
              <h2 className="mt-3 text-2xl font-black">No preferences yet</h2>
              <p className="mt-2 text-sm" style={{ color: c.muted }}>
                Group members haven't starred any acts yet. Open the festival and tap ★ on artists you want to see.
              </p>
            </div>
          )}

          {!loading && sortedListPerformances.length > 0 && (
            <>
              <div className="mb-5 flex flex-wrap gap-2">
                <button type="button" onClick={() => setViewMode('timeline')} className="rounded-full px-5 py-2 text-sm font-black" style={{ background: viewMode === 'timeline' ? group?.festival?.color || c.acc : c.surf, color: viewMode === 'timeline' ? '#fff' : c.muted, border: `1px solid ${viewMode === 'timeline' ? group?.festival?.color || c.acc : c.brd}` }}>
                  Timeline
                </button>
                <button type="button" onClick={() => setViewMode('list')} className="rounded-full px-5 py-2 text-sm font-black" style={{ background: viewMode === 'list' ? group?.festival?.color || c.acc : c.surf, color: viewMode === 'list' ? '#fff' : c.muted, border: `1px solid ${viewMode === 'list' ? group?.festival?.color || c.acc : c.brd}` }}>
                  List
                </button>
              </div>

              {days.length > 0 && (
                <div className="mb-5 flex gap-2 overflow-x-auto pb-2" data-testid="group-day-tabs">
                  {days.map((day) => (
                    <button key={day} type="button" data-testid="group-day-tab" onClick={() => setSelectedDay(day)} className="whitespace-nowrap rounded-full px-4 py-2 text-xs font-black" style={{ background: selectedDay === day ? c.accB : c.surf, color: selectedDay === day ? '#fff' : c.muted, border: `1px solid ${selectedDay === day ? c.accB : c.brd}` }}>
                      {new Date(day).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                    </button>
                  ))}
                </div>
              )}

              {viewMode === 'timeline' && (
                <section className="rounded-[28px] p-4 shadow-2xl" style={{ background: c.surf, border: `1px solid ${c.brd}` }} data-testid="group-timeline">
                  <div className="mb-4 flex flex-wrap gap-2" data-testid="group-stage-filters">
                    {allStages.map((stage) => {
                      const isOn = activeStages[stage.name] !== false;
                      const hasShowsToday = selectedDayPerformances.some((performance) => performance.stage_name === stage.name);
                      return (
                        <button key={stage.name} type="button" data-testid="group-stage-filter" onClick={() => setActiveStages((current) => ({ ...current, [stage.name]: !isOn }))} className="rounded-full px-3 py-1 text-xs font-black" style={{ background: isOn ? stage.color : c.surf2, color: isOn ? '#fff' : c.muted, border: `1px solid ${isOn ? stage.color : c.brd}`, opacity: hasShowsToday ? 1 : 0.45 }}>
                          {stage.name}
                        </button>
                      );
                    })}
                  </div>

                  {visiblePerformances.length === 0 ? (
                    <p style={{ color: c.muted }}>No group picks this day.</p>
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

                        {dayStages.filter((stage) => activeStages[stage.name] !== false).map((stage) => {
                          const stageItems = visiblePerformances.filter((performance) => performance.stage_name === stage.name);
                          return (
                            <div key={stage.name} className="mb-2 flex" data-testid="group-stage-row">
                              <div className="shrink-0 pr-3 text-right text-xs font-black" style={{ width: stageLabelWidth, color: stage.color }}>
                                {stage.name}
                              </div>
                              <div className="relative h-20 flex-1 rounded-2xl" style={{ background: c.surf2, border: `1px solid ${c.brd}` }}>
                                {hours.map((hour) => (
                                  <div key={hour} className="absolute top-0 h-full" style={{ left: (hour - minHour) * hourWidth, width: 1, background: c.brd }} />
                                ))}
                                {stageItems.map((performance) => {
                                  const left = (hourNumber(performance.start_time) - minHour) * hourWidth;
                                  const width = Math.max(118, durationHours(performance.start_time, performance.end_time) * hourWidth - 6);
                                  return (
                                    <div key={performance.id} data-testid="group-performance-block" title={`${performance.artist_name} · ${timeLabel(performance.start_time)}-${timeLabel(performance.end_time)}`} className="absolute top-2 min-h-16 overflow-hidden rounded-xl px-3 py-2 text-left text-xs font-black text-white shadow-lg" style={{ left, width, background: performance.stage_color }}>
                                      <span className="block truncate">{performance.artist_name}</span>
                                      <span className="block truncate text-[10px] opacity-80">{timeLabel(performance.start_time)} – {timeLabel(performance.end_time)}</span>
                                      <div className="mt-1 max-h-7 overflow-hidden">{renderPeoplePills(performance.id)}</div>
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

              {viewMode === 'list' && (
                <div className="rounded-[28px] overflow-hidden shadow-xl" style={{ background: c.surf, border: `1px solid ${c.brd}` }} data-testid="group-schedule-list">
                  <div className="overflow-x-auto scroll-thin">
                    <table className="min-w-full">
                      <thead>
                        <tr style={{ background: c.surf2, borderBottom: `1px solid ${c.brd}` }}>
                          <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-widest" style={{ color: c.muted }}>Date</th>
                          <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-widest" style={{ color: c.muted }}>Time</th>
                          <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-widest" style={{ color: c.muted }}>Stage</th>
                          <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-widest" style={{ color: c.muted }}>Artist</th>
                          <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-widest" style={{ color: '#ffd166' }}>★ Going / Maybe</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedListPerformances.map((perf, idx) => (
                          <tr key={perf.id} style={{ borderTop: idx === 0 ? 'none' : `1px solid ${c.brd}` }} className="transition hover:opacity-80">
                            <td className="px-4 py-3 text-xs font-bold" style={{ color: c.muted }}>{new Date(perf.day_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</td>
                            <td className="px-4 py-3 text-sm font-bold" style={{ color: c.txt }}>{timeLabel(perf.start_time)}</td>
                            <td className="px-4 py-3 text-sm" style={{ color: c.muted }}>{perf.stage_name}</td>
                            <td className="px-4 py-3 text-sm font-black" style={{ color: c.txt }}>{perf.artist_name}</td>
                            <td className="px-4 py-3 text-sm font-bold">{renderPeoplePills(perf.id)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
