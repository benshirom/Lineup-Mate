import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/lib/AuthContext';
import { formatDateRange, getThemeColors } from '@/lib/platform';

interface Profile { display_name?: string | null; email?: string | null; }
interface GroupMember { user_id: string; role: 'owner' | 'member'; profile?: Profile | null; }
interface GroupMemberPref { performance_id: number; status: string; user_id: string; user_label: string; }
interface PerformanceInfo { id: number; artist_name: string; stage_name: string; stage_color: string; start_time: string; end_time: string; day_date: string; }
interface FestivalInfo { id: number; name: string; year: number; location: string | null; start_date: string | null; end_date: string | null; description?: string | null; emoji?: string | null; color?: string | null; genre?: string | null; genre_label?: string | null; website?: string | null; }
interface GroupData { id: number; name: string; invite_code: string; festival_id: number; festival?: FestivalInfo | null; }

type ThemeColors = ReturnType<typeof getThemeColors>;

function PicksBadge({ prefs, c }: { prefs: GroupMemberPref[]; c: ThemeColors }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const computePos = () => {
    if (!btnRef.current) return null;
    const rect = btnRef.current.getBoundingClientRect();
    const estimatedHeight = prefs.length * 22 + 16;
    const spaceBelow = window.innerHeight - rect.bottom;
    // -1px overlap so there is no gap between button and popup hover areas
    const top = spaceBelow > estimatedHeight + 8 ? rect.bottom - 1 : rect.top - estimatedHeight + 1;
    return { top, left: rect.left };
  };

  const show = () => {
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
    setPos(computePos());
    setOpen(true);
  };

  // Cancel pending hide without triggering a re-render (used by popup onPointerEnter)
  const keepOpen = () => {
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
  };

  const scheduleHide = () => {
    hideTimer.current = setTimeout(() => setOpen(false), 150);
  };

  // Close on touch outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: TouchEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('touchstart', handler);
    return () => document.removeEventListener('touchstart', handler);
  }, [open]);

  if (prefs.length === 0) return null;

  if (prefs.length === 1) {
    return (
      <span
        data-testid="group-performance-picks"
        className="max-w-[100px] truncate rounded-full px-2 py-0.5 text-[10px] font-bold"
        style={{ background: `${c.star}22`, color: c.star, border: `1px solid ${c.star}55` }}
      >
        ★ {prefs[0].user_label}
      </span>
    );
  }

  return (
    <div className="inline-block" data-testid="group-performance-picks">
      <button
        ref={btnRef}
        type="button"
        onPointerEnter={(e) => { if (e.pointerType === 'mouse') show(); }}
        onPointerLeave={(e) => { if (e.pointerType === 'mouse') scheduleHide(); }}
        onClick={(e) => {
          e.stopPropagation();
          const pt = (e.nativeEvent as PointerEvent).pointerType;
          if (pt !== 'mouse') { open ? setOpen(false) : show(); }
        }}
        className="rounded-full px-2 py-0.5 text-[10px] font-bold cursor-pointer"
        style={{ background: `${c.star}22`, color: c.star, border: `1px solid ${c.star}55`, touchAction: 'manipulation' }}
      >
        ★ {prefs.length}
      </button>
      {open && pos && typeof document !== 'undefined' && ReactDOM.createPortal(
        <div
          onPointerEnter={(e) => { if (e.pointerType === 'mouse') keepOpen(); }}
          onPointerLeave={(e) => { if (e.pointerType === 'mouse') scheduleHide(); }}
          className="rounded-xl shadow-lg"
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, background: c.surf, border: `1px solid ${c.brd}`, minWidth: 120, padding: '5px 8px 4px' }}
        >
          {prefs.map((p) => (
            <div key={p.user_id} className="truncate py-0.5 text-[11px] font-semibold" style={{ color: c.txt }}>
              {statusLabel(p.status)} {p.user_label}
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

function memberLabel(member: GroupMember): string {
  if (member.profile?.display_name) return member.profile.display_name;
  if (member.profile?.email) return member.profile.email.split('@')[0];
  return `User·${member.user_id.slice(0, 6)}`;
}
function timeLabel(dateString: string) { return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
function absHour(dateString: string, refTime: number): number { return (new Date(dateString).getTime() - refTime) / 36e5; }
function durationHours(start: string, end: string) { return Math.max(0.5, (new Date(end).getTime() - new Date(start).getTime()) / 36e5); }
function festivalTitle(festival: FestivalInfo) { return festival.name.includes(String(festival.year)) ? festival.name : `${festival.name} ${festival.year}`; }
function statusLabel(status: string) { if (status === 'going') return '★'; if (status === 'maybe') return '?'; return '×'; }
function useHourWidth() { const [w, setW] = useState(118); useEffect(() => { const u = () => setW(window.innerWidth < 640 ? 72 : 118); u(); window.addEventListener('resize', u); return () => window.removeEventListener('resize', u); }, []); return w; }
function useStageLabelWidth() { const [w, setW] = useState(132); useEffect(() => { const u = () => setW(window.innerWidth < 640 ? 80 : 132); u(); window.addEventListener('resize', u); return () => window.removeEventListener('resize', u); }, []); return w; }
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
  const [welcomeToast, setWelcomeToast] = useState(false);
  const nowLineRef = useRef<HTMLDivElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (router.query.welcome === '1') {
      setWelcomeToast(true);
      router.replace(`/group/${groupId}`, undefined, { shallow: true });
      setTimeout(() => setWelcomeToast(false), 4000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query.welcome]);

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
          .select('id, name, invite_code, festival_id, is_blocked, festivals(id, name, year, location, start_date, end_date, description, emoji, color, genre, genre_label, website)')
          .eq('id', groupId)
          .single();
        if (groupError) throw groupError;

        if (groupData.is_blocked) {
          setError('This group has been blocked by an administrator.');
          setLoading(false);
          return;
        }

        const mappedGroup: GroupData = {
          id: groupData.id,
          name: groupData.name,
          invite_code: groupData.invite_code,
          festival_id: groupData.festival_id,
          festival: (groupData as any).festivals ?? null
        };
        setGroup(mappedGroup);

        // Auto-save the linked festival for this user (idempotent)
        if (mappedGroup.festival_id) {
          supabase.from('saved_festivals').upsert(
            { user_id: user.id, festival_id: mappedGroup.festival_id },
            { onConflict: 'user_id,festival_id' }
          ).then(() => {});
        }

        // Fetch members and performances in parallel (independent queries)
        const [
          { data: memberData, error: membersError },
          { data: perfData, error: perfError },
        ] = await Promise.all([
          supabase.from('group_members').select('user_id, role').eq('group_id', groupId),
          supabase
            .from('performances')
            .select('id, start_time, end_time, day_date, stages(name, color), artists(name)')
            .eq('festival_id', mappedGroup.festival_id)
            .eq('is_active', true)
            .order('start_time', { ascending: true }),
        ]);
        if (membersError) throw membersError;
        if (perfError) throw perfError;

        const rawMembers = (memberData ?? []) as Array<{ user_id: string; role: 'owner' | 'member' }>;
        const memberIds = rawMembers.map((m) => m.user_id);

        // Fetch profiles and preferences in parallel (both depend on memberIds)
        const [profilesResult, prefsResult] = await Promise.all([
          memberIds.length > 0
            ? supabase.from('profiles').select('id, display_name, email').in('id', memberIds)
            : Promise.resolve({ data: [], error: null }),
          memberIds.length > 0
            ? supabase
                .from('user_performance_preferences')
                .select('performance_id, status, user_id')
                .in('user_id', memberIds)
                .neq('status', null)
            : Promise.resolve({ data: [], error: null }),
        ]);
        if (profilesResult.error) throw profilesResult.error;
        if (prefsResult.error) throw prefsResult.error;

        const profilesById = Object.fromEntries(
          (profilesResult.data ?? []).map((p) => [p.id, { display_name: p.display_name, email: p.email }])
        ) as Record<string, Profile>;
        const memberList = rawMembers.map((m) => ({ ...m, profile: profilesById[m.user_id] ?? null }));
        setMembers(memberList);

        type PerfRow = { id: number; start_time: string; end_time: string; day_date: string; stages: { name: string; color: string | null } | null; artists: { name: string } | null };
        const perfMap: Record<number, PerformanceInfo> = {};
        ((perfData as unknown as PerfRow[]) ?? []).forEach((p) => {
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

        // Build a lookup map for member labels (O(n) instead of O(n²) .find())
        const memberLabelById = Object.fromEntries(
          memberList.map((m) => [m.user_id, memberLabel(m)])
        ) as Record<string, string>;

        if (memberIds.length > 0) {
          const perfIds = new Set(Object.keys(perfMap).map(Number));
          setPerformancePrefs(
            (prefsResult.data ?? [])
              .filter((p) => perfIds.has(p.performance_id))
              .map((p) => ({
                performance_id: p.performance_id,
                status: p.status,
                user_id: p.user_id,
                user_label: memberLabelById[p.user_id] ?? `User·${p.user_id.slice(0, 6)}`,
              }))
          );
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
  }, [authReady, groupId, supabase, user, router, c.acc]);

  const sortedPerformances = useMemo(() => Object.values(performances).sort((a, b) => a.start_time.localeCompare(b.start_time)), [performances]);
  const stageOrder = useMemo(() => Array.from(new Set(sortedPerformances.map((p) => p.stage_name))).sort((a, b) => {
    const aSort = stageSortValue(a, sortedPerformances);
    const bSort = stageSortValue(b, sortedPerformances);
    return aSort.firstStart.localeCompare(bSort.firstStart) || aSort.firstSameTimeIndex - bSort.firstSameTimeIndex || a.localeCompare(b);
  }), [sortedPerformances]);
  const days = useMemo(() => Array.from(new Set(sortedPerformances.map((p) => p.day_date))).sort(), [sortedPerformances]);
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

  const selectedDayPerformances = useMemo(() => sortedPerformances.filter((p) => p.day_date === selectedDay), [sortedPerformances, selectedDay]);
  const visiblePerformances = useMemo(() => selectedDayPerformances.filter((p) => activeStages[p.stage_name] !== false), [selectedDayPerformances, activeStages]);
  const allStages = useMemo(() => {
    const stageMap = new Map<string, string>();
    sortedPerformances.forEach((p) => stageMap.set(p.stage_name, p.stage_color));
    return stageOrder.map((name) => ({ name, color: stageMap.get(name) || c.acc }));
  }, [sortedPerformances, stageOrder, c.acc]);
  const dayStages = useMemo(() => {
    const stageMap = new Map<string, string>();
    selectedDayPerformances.forEach((p) => stageMap.set(p.stage_name, p.stage_color));
    return stageOrder.filter((name) => stageMap.has(name)).map((name) => ({ name, color: stageMap.get(name) || c.acc }));
  }, [selectedDayPerformances, stageOrder, c.acc]);
  const listPerformances = useMemo(() => visiblePerformances, [visiblePerformances]);

  const refTime = useMemo(() => {
    if (!sortedPerformances.length) return 0;
    const d = new Date(Math.min(...sortedPerformances.map((p) => new Date(p.start_time).getTime())));
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, [sortedPerformances]);

  const timelinePerformances = useMemo(() => sortedPerformances.filter((p) => activeStages[p.stage_name] !== false), [sortedPerformances, activeStages]);

  const hours = useMemo(() => {
    if (!sortedPerformances.length || !refTime) return Array.from({ length: 8 }, (_, i) => i);
    const min = Math.floor(Math.min(...sortedPerformances.map((p) => absHour(p.start_time, refTime))));
    const max = Math.ceil(Math.max(...sortedPerformances.map((p) => absHour(p.end_time, refTime))));
    return Array.from({ length: Math.max(1, max - min) }, (_, i) => min + i);
  }, [sortedPerformances, refTime]);

  const hourWidth = useHourWidth();
  const stageLabelWidth = useStageLabelWidth();

  const minHour = hours[0] || 0;

  const scrollToDay = (dayDate: string) => {
    if (!refTime || !timelineRef.current) return;
    const absH = (new Date(dayDate + 'T00:00:00').getTime() - refTime) / 36e5;
    timelineRef.current.scrollTo({ left: Math.max(0, (absH - minHour) * hourWidth), behavior: 'smooth' });
  };

  useEffect(() => {
    if (viewMode === 'timeline' && selectedDay && refTime) {
      setTimeout(() => scrollToDay(selectedDay), 50);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, refTime]);

  // Sync selected day button as user scrolls the timeline
  useEffect(() => {
    if (viewMode !== 'timeline') return;
    const el = timelineRef.current;
    if (!el || !refTime || !hours.length || !days.length) return;
    const onScroll = () => {
      const visibleAbsHour = minHour + el.scrollLeft / hourWidth;
      const visibleDate = new Date(refTime + visibleAbsHour * 36e5).toLocaleDateString('sv');
      const match = [...days].reverse().find((d) => d <= visibleDate);
      if (match) setSelectedDay(match);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, days, refTime, hours, minHour, hourWidth]);

  const copyInviteCode = async () => { if (!group?.invite_code) return; await navigator.clipboard.writeText(group.invite_code); setCopied(true); setTimeout(() => setCopied(false), 1600); };

  const renderPeoplePills = (performanceId: number, mode: 'compact' | 'full' = 'full') => {
    const prefs = performancePreferenceMap[performanceId] ?? [];
    if (prefs.length === 0) return null;
    if (mode === 'compact') {
      return <PicksBadge prefs={prefs} c={c} />;
    }
    return (
      <div
        className="flex max-h-24 flex-wrap gap-1 overflow-y-auto pr-1"
        data-testid="group-performance-picks"
        title={prefs.map((p) => `${p.user_label} · ${p.status}`).join(', ')}
      >
        {prefs.map((pref) => (
          <span
            key={`${pref.user_id}-${pref.status}`}
            className="max-w-[140px] truncate rounded-full px-2 py-1 text-[10px] font-bold"
            style={{
              background: pref.status === 'going' ? `${c.star}22` : c.accSoft,
              color: pref.status === 'going' ? c.star : c.acc,
              border: `1px solid ${pref.status === 'going' ? `${c.star}55` : `${c.acc}44`}`
            }}
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
      {welcomeToast && (
        <div
          className="toast-slide-in fixed bottom-24 left-1/2 z-50 max-w-xs rounded-2xl px-4 py-3 text-sm font-bold shadow-xl"
          style={{
            transform: 'translateX(-50%)',
            background: '#1e293b',
            color: '#f1f5f9',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
          role="status"
        >
          🎵 Welcome to the group!
        </div>
      )}
      <main className="mobile-shell-padding" style={{ minHeight: '100dvh', background: c.bg, color: c.txt }}>
        <section className="mx-auto max-w-7xl px-4 py-6 md:py-8">
          <header className="fade-up mb-6 overflow-hidden rounded-3xl shadow-card" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
            <div className="h-px" style={{ background: c.brd }} />
            <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-[1fr_auto] lg:grid-cols-[1fr_260px] lg:items-center">
              <div>
                <p className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.18em]" style={{ color: group?.festival?.color || c.acc }}>Group Schedule</p>
                <h1 data-testid="group-schedule-title" className="text-2xl font-extrabold sm:text-4xl" style={{ letterSpacing: '-0.02em' }}>
                  {group ? group.name : 'Loading…'}
                </h1>
                {group?.festival && (
                  <p className="mt-1 text-sm" style={{ color: c.muted }}>
                    {festivalTitle(group.festival)} · {formatDateRange(group.festival.start_date, group.festival.end_date)}
                  </p>
                )}
              </div>
              <div className="rounded-2xl p-4" style={{ background: c.surf2, border: `1px solid ${c.brd}` }}>
                <div className="space-y-1.5 text-sm" style={{ color: c.muted }}>
                  <div>👥 <b style={{ color: c.txt }}>{members.length}</b> members</div>
                  {group?.festival && <div>📍 {group.festival.location || 'Location TBA'}</div>}
                  {group?.festival && <div>📅 {formatDateRange(group.festival.start_date, group.festival.end_date)}</div>}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {group && (
                    <button
                      type="button"
                      onClick={() => router.push(`/festival/${group.festival_id}`)}
                      className="tap-active rounded-full px-3 py-1.5 text-xs font-bold"
                      style={{ background: c.surf, border: `1px solid ${c.brd}`, color: c.txt, minHeight: 36 }}
                    >
                      Open Festival
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => router.push('/groups')}
                    className="tap-active rounded-full px-3 py-1.5 text-xs font-bold"
                    style={{ background: c.surf, border: `1px solid ${c.brd}`, color: c.txt, minHeight: 36 }}
                  >
                    ← Groups
                  </button>
                </div>
              </div>
            </div>
          </header>

          {loading && <p style={{ color: c.muted }}>Loading group schedule…</p>}
          {error && (
            <p data-testid="group-schedule-error" className="mb-4 rounded-2xl p-4 text-sm font-semibold" style={{ background: `${c.danger}18`, color: c.danger, border: `1px solid ${c.danger}44` }}>
              {error}
            </p>
          )}

          {!loading && group && (
            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-3xl p-5" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
                <h2 className="mb-1 font-extrabold">Invite friends</h2>
                <p className="mb-4 text-sm" style={{ color: c.muted }}>Share this code so friends can join from the Groups page or the festival page.</p>
                <div className="flex items-center gap-2">
                  <code
                    data-testid="group-page-invite-code"
                    className="flex-1 rounded-2xl px-4 py-3 text-sm font-bold"
                    style={{ background: c.surf2, color: c.txt, border: `1px solid ${c.brd}` }}
                  >
                    {group.invite_code}
                  </code>
                  <button
                    type="button"
                    onClick={copyInviteCode}
                    className="tap-active rounded-full px-4 py-3 text-sm font-bold text-white"
                    style={{ background: copied ? c.success : c.acc, minHeight: 48 }}
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
              <div className="rounded-3xl p-5" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
                <h2 className="mb-3 font-extrabold">Members ({members.length})</h2>
                <ul className="flex max-h-28 flex-wrap gap-2 overflow-y-auto pr-1">
                  {members.map((member) => (
                    <li
                      key={member.user_id}
                      data-testid="group-member-pill"
                      className="flex items-center gap-2 rounded-full px-3 py-2"
                      style={{ background: c.surf2 }}
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold" style={{ background: `${c.acc}33`, color: c.acc }}>
                        {memberLabel(member).slice(0, 1).toUpperCase()}
                      </span>
                      <span className="text-sm font-semibold">{memberLabel(member)}</span>
                      <span className="text-[10px] font-bold uppercase" style={{ color: c.muted }}>{member.role}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {!loading && !error && sortedPerformances.length === 0 && (
            <div data-testid="group-empty-picks" className="rounded-3xl p-8 text-center" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
              <div className="text-5xl">🎶</div>
              <h2 className="mt-3 text-2xl font-extrabold">No lineup yet</h2>
              <p className="mt-2 text-sm" style={{ color: c.muted }}>This festival has no imported performances yet.</p>
            </div>
          )}

          {!loading && sortedPerformances.length > 0 && (
            <>
              {/* View mode + controls */}
              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className="tap-active rounded-full px-5 text-sm font-bold"
                  style={{
                    background: viewMode === 'list' ? group?.festival?.color || c.acc : c.surf,
                    color: viewMode === 'list' ? '#fff' : c.muted,
                    border: `1px solid ${viewMode === 'list' ? group?.festival?.color || c.acc : c.brd}`,
                    minHeight: 44,
                    paddingTop: 10,
                    paddingBottom: 10,
                  }}
                >
                  List
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('timeline')}
                  className="tap-active rounded-full px-5 text-sm font-bold"
                  style={{
                    background: viewMode === 'timeline' ? group?.festival?.color || c.acc : c.surf,
                    color: viewMode === 'timeline' ? '#fff' : c.muted,
                    border: `1px solid ${viewMode === 'timeline' ? group?.festival?.color || c.acc : c.brd}`,
                    minHeight: 44,
                    paddingTop: 10,
                    paddingBottom: 10,
                  }}
                >
                  Timeline
                </button>
              </div>

              {days.length > 0 && (
                <div className="relative mb-4">
                  <div
                    className="flex gap-2 overflow-x-auto scroll-hidden py-1 px-0.5"
                    data-testid="group-day-tabs"
                    style={{ maskImage: 'linear-gradient(to right, transparent 0%, black 3%, black 97%, transparent 100%)' }}
                  >
                    {days.map((day) => (
                      <button
                        key={day}
                        type="button"
                        data-testid="group-day-tab"
                        onClick={() => { setSelectedDay(day); scrollToDay(day); }}
                        className="tap-active whitespace-nowrap rounded-full px-4 text-xs font-bold"
                        style={{
                          background: selectedDay === day ? c.acc : c.surf,
                          color: selectedDay === day ? '#fff' : c.muted,
                          border: `1px solid ${selectedDay === day ? c.acc : c.brd}`,
                          minHeight: 36,
                          paddingTop: 8,
                          paddingBottom: 8,
                        }}
                      >
                        {new Date(day).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-4 flex gap-2 overflow-x-auto scroll-hidden pb-1" data-testid="group-stage-filters">
                {allStages.map((stage) => {
                  const isOn = activeStages[stage.name] !== false;
                  const hasShowsToday = selectedDayPerformances.some((p) => p.stage_name === stage.name);
                  return (
                    <button
                      key={stage.name}
                      type="button"
                      data-testid="group-stage-filter"
                      onClick={() => setActiveStages((current) => ({ ...current, [stage.name]: !isOn }))}
                      className="tap-active shrink-0 rounded-full px-3 py-1.5 text-xs font-bold"
                      style={{
                        background: isOn ? stage.color : c.surf2,
                        color: isOn ? '#fff' : c.muted,
                        border: `1px solid ${isOn ? stage.color : c.brd}`,
                        opacity: hasShowsToday ? 1 : 0.45
                      }}
                    >
                      {stage.name}
                    </button>
                  );
                })}
              </div>

              {/* ── List view (default) ──────────────────────────── */}
              {viewMode === 'list' && (
                <div data-testid="group-schedule-list">
                  {/* Desktop table */}
                  <div className="hidden sm:block overflow-hidden rounded-3xl shadow-card" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
                    <div className="overflow-x-auto scroll-thin">
                      <table className="min-w-full">
                        <thead>
                          <tr style={{ background: c.surf2, borderBottom: `1px solid ${c.brd}` }}>
                            <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-widest" style={{ color: c.muted }}>Date</th>
                            <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-widest" style={{ color: c.muted }}>Time</th>
                            <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-widest" style={{ color: c.muted }}>Stage</th>
                            <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-widest" style={{ color: c.muted }}>Artist</th>
                            <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-widest" style={{ color: c.star }}>★ Group picks</th>
                          </tr>
                        </thead>
                        <tbody>
                          {listPerformances.map((perf, idx) => (
                            <tr key={perf.id} data-testid="group-list-row" style={{ borderTop: idx === 0 ? 'none' : `1px solid ${c.brd}` }}>
                              <td className="px-4 py-3 text-xs font-semibold" style={{ color: c.muted }}>{new Date(perf.day_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</td>
                              <td className="px-4 py-3 text-sm font-semibold" style={{ color: c.txt }}>{timeLabel(perf.start_time)}</td>
                              <td className="px-4 py-3 text-sm">
                                <span className="inline-flex items-center gap-1.5">
                                  <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ background: perf.stage_color }} />
                                  <span style={{ color: c.muted }}>{perf.stage_name}</span>
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm font-bold" style={{ color: c.txt }}>{perf.artist_name}</td>
                              <td className="px-4 py-3 text-sm font-semibold">{renderPeoplePills(perf.id)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Mobile cards */}
                  <div className="sm:hidden space-y-3">
                    {listPerformances.map((perf) => (
                      <article
                        key={perf.id}
                        data-testid="group-list-row"
                        className="overflow-hidden rounded-2xl perf-card"
                        style={{
                          background: c.surf,
                          border: `1px solid ${c.brd}`,
                          borderLeft: `4px solid ${perf.stage_color}`,
                          minHeight: 80,
                        }}
                      >
                        <div className="flex items-start gap-3 px-4 py-3.5">
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate font-bold leading-snug" style={{ color: c.txt }}>{perf.artist_name}</h3>
                            <p className="text-xs font-semibold mt-0.5" style={{ color: perf.stage_color }}>{perf.stage_name}</p>
                            <p className="text-xs mt-0.5" style={{ color: c.muted }}>
                              {new Date(perf.day_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                              {' · '}
                              {timeLabel(perf.start_time)}
                            </p>
                          </div>
                        </div>
                        <div className="px-4 pb-3.5">{renderPeoplePills(perf.id)}</div>
                      </article>
                    ))}
                  </div>

                  {listPerformances.length === 0 && (
                    <p className="rounded-2xl p-4 text-sm" style={{ background: c.surf, color: c.muted, border: `1px solid ${c.brd}` }}>
                      No performances match the selected day and stage filters.
                    </p>
                  )}
                </div>
              )}

              {/* ── Timeline view (secondary) ────────────────────── */}
              {viewMode === 'timeline' && (
                <section className="rounded-3xl p-4 shadow-card" style={{ background: c.surf, border: `1px solid ${c.brd}` }} data-testid="group-timeline">
                  {timelinePerformances.length === 0 ? (
                    <p style={{ color: c.muted }}>No performances with the selected stage filters.</p>
                  ) : (
                    <div ref={timelineRef} className="relative overflow-x-auto scroll-thin" data-testid="group-timeline-scroll">
                      <div style={{ minWidth: stageLabelWidth + hours.length * hourWidth }}>
                        <div className="mb-2 flex" style={{ marginLeft: stageLabelWidth }}>
                          {hours.map((hour) => {
                            const isMidnight = hour % 24 === 0 && hour !== hours[0];
                            const dateLabel = isMidnight ? new Date(refTime + hour * 36e5).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : null;
                            return (
                              <div key={hour} className="shrink-0 pl-2 text-xs font-bold" style={{ width: hourWidth, color: isMidnight ? c.acc : c.muted, borderLeft: `${isMidnight ? 2 : 1}px solid ${isMidnight ? c.acc : c.brd}` }}>
                                {dateLabel ? <span style={{ color: c.acc, fontWeight: 800 }}>{dateLabel}</span> : `${String(hour % 24).padStart(2, '0')}:00`}
                              </div>
                            );
                          })}
                        </div>
                        {allStages.filter((s) => activeStages[s.name] !== false).map((stage) => (
                          <div key={stage.name} className="mb-2 flex items-stretch" data-testid="group-stage-row">
                            <div
                              className="shrink-0 pr-2 text-right text-xs font-bold leading-tight flex items-center justify-end"
                              style={{ width: stageLabelWidth, color: stage.color, position: 'sticky', left: 0, zIndex: 2, background: c.surf }}
                            >
                              <span className="rounded-lg px-1.5 py-0.5" style={{ background: `${stage.color}18` }}>{stage.name}</span>
                            </div>
                            <div className="relative h-20 flex-1 rounded-2xl overflow-hidden" style={{ background: `${stage.color}06`, border: `1px solid ${c.brd}` }}>
                              {hours.map((hour) => {
                                const isMidnight = hour % 24 === 0 && hour !== hours[0];
                                return (
                                  <div key={hour} className="absolute top-0 h-full" style={{ left: (hour - minHour) * hourWidth, width: isMidnight ? 2 : 1, background: isMidnight ? `${c.acc}66` : c.brd }} />
                                );
                              })}
                              {timelinePerformances.filter((p) => p.stage_name === stage.name).map((p) => {
                                const left = (absHour(p.start_time, refTime) - minHour) * hourWidth;
                                const width = Math.max(60, durationHours(p.start_time, p.end_time) * hourWidth - 4);
                                const prefs = performancePreferenceMap[p.id] ?? [];
                                const hasPicks = prefs.length > 0;
                                return (
                                  <div
                                    key={p.id}
                                    data-testid="group-performance-block"
                                    title={`${p.artist_name} · ${timeLabel(p.start_time)}–${timeLabel(p.end_time)}`}
                                    className="perf-block absolute top-2 h-16 overflow-hidden rounded-xl py-1.5 text-left text-xs font-bold"
                                    style={{
                                      left,
                                      width,
                                      background: c.surf2,
                                      borderLeft: `3px solid ${p.stage_color}`,
                                      paddingLeft: 10,
                                      paddingRight: 8,
                                      color: c.txt,
                                      boxShadow: hasPicks
                                        ? `inset 0 0 0 1px ${p.stage_color}44`
                                        : `inset 0 0 0 1px ${c.brd}`,
                                      opacity: hasPicks ? 1 : 0.6,
                                    }}
                                  >
                                    <span className="block truncate leading-4" style={{ color: c.txt }}>{p.artist_name}</span>
                                    <span className="block truncate text-[10px]" style={{ color: c.muted }}>{timeLabel(p.start_time)} – {timeLabel(p.end_time)}</span>
                                    <div className="mt-1">{renderPeoplePills(p.id, 'compact')}</div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </section>
      </main>
    </>
  );
}
