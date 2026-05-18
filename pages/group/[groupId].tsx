import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/lib/AuthContext';
import { formatDateRange, getThemeColors } from '@/lib/platform';

interface Profile { display_name?: string | null; email?: string | null; }
interface GroupMember { user_id: string; role: 'owner' | 'member'; profile?: Profile | null; }
interface GroupMemberPref { performance_id: number; status: string; user_id: string; user_label: string; }
interface PerformanceInfo { id: number; artist_name: string; stage_name: string; stage_color: string; start_time: string; end_time: string; day_date: string; }
interface FestivalInfo { id: number; name: string; year: number; location: string | null; start_date: string | null; end_date: string | null; description?: string | null; emoji?: string | null; color?: string | null; genre?: string | null; genre_label?: string | null; website?: string | null; }
interface GroupData { id: number; name: string; invite_code: string; festival_id: number; festival?: FestivalInfo | null; }

function memberLabel(member: GroupMember): string {
  if (member.profile?.display_name) return member.profile.display_name;
  if (member.profile?.email) return member.profile.email.split('@')[0];
  return `User·${member.user_id.slice(0, 6)}`;
}
function timeLabel(dateString: string) { return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
function dayLabel(dateString: string) { return new Date(dateString).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }); }
function festivalTitle(festival: FestivalInfo) { return festival.name.includes(String(festival.year)) ? festival.name : `${festival.name} ${festival.year}`; }
function statusLabel(status: string) { if (status === 'going') return 'Going'; if (status === 'maybe') return 'Maybe'; return 'Not interested'; }
function stageSortValue(stageName: string, performances: PerformanceInfo[]) {
  const stagePerformances = performances.filter((p) => p.stage_name === stageName);
  const firstStart = stagePerformances.map((p) => p.start_time).sort()[0] || '';
  const firstSameTimeIndex = performances.findIndex((p) => p.stage_name === stageName && p.start_time === firstStart);
  return { firstStart, firstSameTimeIndex: firstSameTimeIndex === -1 ? 9999 : firstSameTimeIndex };
}

export default function GroupPage() {
  const router = useRouter();
  const { groupId } = router.query;
  const { user, authReady, supabase, theme } = useAuth();
  const c = getThemeColors(theme);

  const [group, setGroup] = useState<GroupData | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [performancePrefs, setPerformancePrefs] = useState<GroupMemberPref[]>([]);
  const [performances, setPerformances] = useState<Record<number, PerformanceInfo>>({});
  const [selectedDay, setSelectedDay] = useState('');
  const [activeStages, setActiveStages] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!authReady) return;
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

        const { data: memberData, error: membersError } = await supabase.from('group_members').select('user_id, role').eq('group_id', groupId);
        if (membersError) throw membersError;
        const rawMembers = (memberData ?? []) as Array<{ user_id: string; role: 'owner' | 'member' }>;
        const memberIds = rawMembers.map((m) => m.user_id);

        let profilesById: Record<string, Profile> = {};
        if (memberIds.length > 0) {
          const { data: profilesData, error: profilesError } = await supabase.from('profiles').select('id, display_name, email').in('id', memberIds);
          if (profilesError) throw profilesError;
          profilesById = Object.fromEntries((profilesData ?? []).map((p: any) => [p.id, { display_name: p.display_name, email: p.email }]));
        }
        const memberList = rawMembers.map((m) => ({ ...m, profile: profilesById[m.user_id] ?? null }));
        setMembers(memberList);

        const { data: perfData, error: perfError } = await supabase
          .from('performances')
          .select('id, start_time, end_time, day_date, stages(name, color), artists(name)')
          .eq('festival_id', mappedGroup.festival_id)
          .eq('is_active', true)
          .order('start_time', { ascending: true });
        if (perfError) throw perfError;

        const perfMap: Record<number, PerformanceInfo> = {};
        perfData?.forEach((p: any) => {
          perfMap[p.id] = {
            id: p.id,
            artist_name: p.artists?.name ?? 'Unknown Artist',
            stage_name: p.stages?.name ?? 'Stage',
            stage_color: p.stages?.color ?? mappedGroup.festival?.color ?? c.secondary,
            start_time: p.start_time,
            end_time: p.end_time,
            day_date: p.day_date
          };
        });
        setPerformances(perfMap);

        if (memberIds.length > 0) {
          const { data: prefs, error: prefsError } = await supabase
            .from('user_performance_preferences')
            .select('performance_id, status, user_id')
            .in('user_id', memberIds)
            .neq('status', null);
          if (prefsError) throw prefsError;
          const perfIds = new Set(Object.keys(perfMap).map(Number));
          setPerformancePrefs((prefs ?? []).filter((p: any) => perfIds.has(p.performance_id)).map((p: any) => {
            const match = memberList.find((m) => m.user_id === p.user_id);
            return { performance_id: p.performance_id, status: p.status, user_id: p.user_id, user_label: match ? memberLabel(match) : `User·${p.user_id.slice(0, 6)}` };
          }));
        } else {
          setPerformancePrefs([]);
        }

        const loaded = Object.values(perfMap).sort((a, b) => a.start_time.localeCompare(b.start_time));
        const nextDays = Array.from(new Set(loaded.map((p) => p.day_date))).sort();
        const stageNames = Array.from(new Set(loaded.map((p) => p.stage_name)));
        const nextStages = stageNames.sort((a, b) => {
          const aSort = stageSortValue(a, loaded);
          const bSort = stageSortValue(b, loaded);
          return aSort.firstStart.localeCompare(bSort.firstStart) || aSort.firstSameTimeIndex - bSort.firstSameTimeIndex || a.localeCompare(b);
        });
        setSelectedDay((current) => current && nextDays.includes(current) ? current : nextDays[0] ?? '');
        setActiveStages(Object.fromEntries(nextStages.map((stage) => [stage, true])));
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Could not load group schedule.');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [authReady, groupId, supabase, user, router, c.secondary]);

  const sortedPerformances = useMemo(() => Object.values(performances).sort((a, b) => a.start_time.localeCompare(b.start_time)), [performances]);
  const stageOrder = useMemo(() => Array.from(new Set(sortedPerformances.map((p) => p.stage_name))).sort((a, b) => {
    const aSort = stageSortValue(a, sortedPerformances);
    const bSort = stageSortValue(b, sortedPerformances);
    return aSort.firstStart.localeCompare(bSort.firstStart) || aSort.firstSameTimeIndex - bSort.firstSameTimeIndex || a.localeCompare(b);
  }), [sortedPerformances]);
  const days = useMemo(() => Array.from(new Set(sortedPerformances.map((p) => p.day_date))).sort(), [sortedPerformances]);
  const selectedDayPerformances = useMemo(() => sortedPerformances.filter((p) => p.day_date === selectedDay), [sortedPerformances, selectedDay]);
  const visiblePerformances = useMemo(() => selectedDayPerformances.filter((p) => activeStages[p.stage_name] !== false), [selectedDayPerformances, activeStages]);
  const allStages = useMemo(() => {
    const stageMap = new Map<string, string>();
    sortedPerformances.forEach((p) => stageMap.set(p.stage_name, p.stage_color));
    return stageOrder.map((name) => ({ name, color: stageMap.get(name) || c.secondary }));
  }, [sortedPerformances, stageOrder, c.secondary]);
  const performancePreferenceMap = useMemo(() => {
    const result: Record<number, GroupMemberPref[]> = {};
    performancePrefs.forEach((pref) => {
      if (!performances[pref.performance_id]) return;
      if (!result[pref.performance_id]) result[pref.performance_id] = [];
      result[pref.performance_id].push(pref);
    });
    Object.values(result).forEach((prefs) => prefs.sort((a, b) => a.user_label.localeCompare(b.user_label)));
    return result;
  }, [performancePrefs, performances]);

  const copyInviteCode = async () => {
    if (!group?.invite_code) return;
    await navigator.clipboard.writeText(group.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const renderPeoplePills = (performanceId: number) => {
    const prefs = performancePreferenceMap[performanceId] ?? [];
    if (prefs.length === 0) return <span className="text-xs font-bold" style={{ color: c.muted }}>No group picks yet</span>;
    return (
      <div className="flex flex-wrap gap-1.5" data-testid="group-performance-picks" title={prefs.map((p) => `${p.user_label} · ${p.status}`).join(', ')}>
        {prefs.map((pref) => (
          <span key={`${pref.user_id}-${pref.status}`} className="rounded-full px-2.5 py-1 text-[10px] font-black" style={{ background: pref.status === 'going' ? 'rgba(250,204,21,0.14)' : c.primarySoft, color: pref.status === 'going' ? c.star : c.primary, border: `1px solid ${pref.status === 'going' ? 'rgba(250,204,21,0.28)' : 'rgba(139,92,246,0.26)'}` }}>
            {statusLabel(pref.status)} · {pref.user_label}
          </span>
        ))}
      </div>
    );
  };

  return (
    <>
      <Navbar />
      <main className="mobile-shell-padding" style={{ minHeight: '100vh', background: c.bg, color: c.txt }}>
        <section className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10">
          <header className="premium-card mb-6 p-5 sm:p-6">
            <div className="relative z-10 grid gap-5 lg:grid-cols-[1fr_320px] lg:items-center">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: c.primary }}>Group Schedule</p>
                <h1 data-testid="group-schedule-title" className="app-title mt-2 text-4xl font-black leading-tight sm:text-5xl">{group ? group.name : 'Loading…'}</h1>
                {group?.festival && <p className="mt-3 text-sm leading-6" style={{ color: c.textSecondary }}>{festivalTitle(group.festival)} · {formatDateRange(group.festival.start_date, group.festival.end_date)}</p>}
              </div>
              <div className="rounded-2xl p-4" style={{ background: c.surfaceHover, border: `1px solid ${c.border}` }}>
                <div className="space-y-1.5 text-sm" style={{ color: c.muted }}>
                  <div><b style={{ color: c.txt }}>{members.length}</b> members</div>
                  {group?.festival && <div>{group.festival.location || 'Location TBA'}</div>}
                  {group?.festival && <div>{formatDateRange(group.festival.start_date, group.festival.end_date)}</div>}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {group && <button type="button" onClick={() => router.push(`/festival/${group.festival_id}`)} className="mobile-action rounded-2xl px-3 py-2 text-xs font-black" style={{ background: c.surface, border: `1px solid ${c.border}`, color: c.txt }}>Festival</button>}
                  <button type="button" onClick={() => router.push('/groups')} className="mobile-action rounded-2xl px-3 py-2 text-xs font-black" style={{ background: c.surface, border: `1px solid ${c.border}`, color: c.txt }}>Groups</button>
                </div>
              </div>
            </div>
          </header>

          {loading && <p style={{ color: c.muted }}>Loading group schedule…</p>}
          {error && <p data-testid="group-schedule-error" className="mb-4 rounded-2xl p-4 text-sm font-bold" style={{ background: 'rgba(239,68,68,0.12)', color: c.danger, border: '1px solid rgba(239,68,68,0.26)' }}>{error}</p>}

          {!loading && group && (
            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="premium-card p-5">
                <div className="relative z-10"><h2 className="app-title mb-1 text-xl font-black">Invite friends</h2><p className="mb-4 text-sm" style={{ color: c.muted }}>Share this code so friends can join from the Groups page.</p><div className="flex items-center gap-2"><code data-testid="group-page-invite-code" className="mobile-action flex-1 rounded-2xl px-4 py-3 text-sm font-black tracking-[0.06em]" style={{ background: c.surfaceHover, color: c.txt, border: `1px solid ${c.border}` }}>{group.invite_code}</code><button type="button" onClick={copyInviteCode} className="mobile-action rounded-2xl px-4 py-3 text-sm font-black text-white" style={{ background: copied ? c.success : c.secondary }}>{copied ? 'Copied' : 'Copy'}</button></div></div>
              </div>
              <div className="premium-card p-5">
                <div className="relative z-10"><h2 className="app-title mb-3 text-xl font-black">Members ({members.length})</h2><ul className="flex max-h-36 flex-wrap gap-2 overflow-y-auto pr-1 scroll-thin">{members.map((member) => <li key={member.user_id} data-testid="group-member-pill" className="flex items-center gap-2 rounded-full px-3 py-2" style={{ background: c.surfaceHover, border: `1px solid ${c.border}` }}><span className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-black" style={{ background: c.primarySoft, color: c.primary }}>{memberLabel(member).slice(0, 1).toUpperCase()}</span><span className="text-sm font-bold">{memberLabel(member)}</span><span className="text-[10px] font-black uppercase" style={{ color: c.muted }}>{member.role}</span></li>)}</ul></div>
              </div>
            </div>
          )}

          {!loading && !error && sortedPerformances.length === 0 && <div data-testid="group-empty-picks" className="premium-card p-8 text-center"><div className="relative z-10"><h2 className="app-title text-2xl font-black">No lineup yet</h2><p className="mt-2 text-sm" style={{ color: c.muted }}>This festival has no imported performances yet.</p></div></div>}

          {!loading && sortedPerformances.length > 0 && (
            <>
              <div className="mb-5 flex gap-2 overflow-x-auto scroll-hidden pb-1">
                <button type="button" onClick={() => setViewMode('list')} className="mobile-action shrink-0 rounded-full px-5 py-2 text-sm font-black" style={{ background: viewMode === 'list' ? c.primarySoft : c.surface, color: viewMode === 'list' ? c.primary : c.muted, border: `1px solid ${viewMode === 'list' ? 'rgba(139,92,246,0.28)' : c.border}` }}>List</button>
                <button type="button" onClick={() => setViewMode('timeline')} className="mobile-action shrink-0 rounded-full px-5 py-2 text-sm font-black" style={{ background: viewMode === 'timeline' ? c.primarySoft : c.surface, color: viewMode === 'timeline' ? c.primary : c.muted, border: `1px solid ${viewMode === 'timeline' ? 'rgba(139,92,246,0.28)' : c.border}` }}>Timeline</button>
              </div>

              {days.length > 0 && <div className="mb-5 flex gap-2 overflow-x-auto scroll-hidden pb-1" data-testid="group-day-tabs">{days.map((day) => <button key={day} type="button" data-testid="group-day-tab" onClick={() => setSelectedDay(day)} className="mobile-action shrink-0 rounded-full px-4 py-2 text-xs font-black" style={{ background: selectedDay === day ? c.primarySoft : c.surface, color: selectedDay === day ? c.primary : c.muted, border: `1px solid ${selectedDay === day ? 'rgba(139,92,246,0.28)' : c.border}` }}>{new Date(day).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</button>)}</div>}

              <div className="mb-4 flex gap-2 overflow-x-auto scroll-hidden pb-1" data-testid="group-stage-filters">{allStages.map((stage) => { const isOn = activeStages[stage.name] !== false; const hasShowsToday = selectedDayPerformances.some((p) => p.stage_name === stage.name); return <button key={stage.name} type="button" data-testid="group-stage-filter" onClick={() => setActiveStages((current) => ({ ...current, [stage.name]: !isOn }))} className="mobile-action shrink-0 rounded-full px-3 py-2 text-xs font-black" style={{ background: isOn ? c.secondarySoft : c.surface, color: isOn ? c.secondary : c.muted, border: `1px solid ${isOn ? 'rgba(6,182,212,0.28)' : c.border}`, opacity: hasShowsToday ? 1 : 0.45 }}>{stage.name}</button>; })}</div>

              {viewMode === 'timeline' && (
                <section className="premium-card p-5" data-testid="group-timeline">
                  <div className="relative z-10"><p className="mb-3 text-sm" style={{ color: c.muted }}>Timeline is available as a secondary view. For mobile planning, the list below is the primary experience.</p><div className="grid grid-cols-1 gap-3 md:grid-cols-2">{visiblePerformances.map((perf) => <article key={perf.id} data-testid="group-performance-block" className="rounded-2xl p-4" style={{ background: c.surfaceHover, border: `1px solid ${c.border}`, borderLeft: `4px solid ${perf.stage_color}` }}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate font-black">{perf.artist_name}</h3><p className="text-sm" style={{ color: c.muted }}>{timeLabel(perf.start_time)} – {timeLabel(perf.end_time)} · {perf.stage_name}</p></div><span className="text-xs font-black" style={{ color: c.secondary }}>{timeLabel(perf.start_time)}</span></div><div className="mt-3">{renderPeoplePills(perf.id)}</div></article>)}</div></div>
                </section>
              )}

              {viewMode === 'list' && (
                <div data-testid="group-schedule-list" className="space-y-3">
                  {visiblePerformances.map((perf) => <article key={perf.id} data-testid="group-list-row" className="premium-card p-4"><div className="relative z-10"><div data-testid="group-performance-block" className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-black uppercase tracking-[0.14em]" style={{ color: c.secondary }}>{dayLabel(perf.day_date)}</p><h3 className="app-title mt-1 truncate text-xl font-black">{perf.artist_name}</h3><p className="mt-1 text-sm" style={{ color: c.muted }}>{timeLabel(perf.start_time)} – {timeLabel(perf.end_time)} · <span style={{ color: perf.stage_color }}>{perf.stage_name}</span></p></div><span className="shrink-0 rounded-full px-3 py-1 text-xs font-black" style={{ background: c.surfaceHover, color: c.textSecondary, border: `1px solid ${c.border}` }}>{timeLabel(perf.start_time)}</span></div><div className="mt-3">{renderPeoplePills(perf.id)}</div></div></article>)}
                  {visiblePerformances.length === 0 && <p className="rounded-2xl p-4 text-sm" style={{ background: c.surface, color: c.muted, border: `1px solid ${c.border}` }}>No performances match the selected day and stage filters.</p>}
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </>
  );
}
