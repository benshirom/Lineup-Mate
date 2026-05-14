import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/lib/AuthContext';
import { getThemeColors } from '@/lib/platform';

interface Profile {
  display_name?: string | null;
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
  start_time: string;
  end_time: string;
  day_date: string;
}

interface GroupData {
  id: number;
  name: string;
  invite_code: string;
  festival_id: number;
  festival_name: string;
  festival_year: number;
  festival_emoji: string;
  festival_color: string;
}

function memberLabel(member: GroupMember): string {
  if (member.profile?.display_name) return member.profile.display_name;
  return `User·${member.user_id.slice(0, 6)}`;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const myRole = members.find((m) => m.user_id === user?.id)?.role ?? null;

  useEffect(() => {
    if (!user) { router.push('/login'); return; }
    if (!groupId) return;

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: groupData, error: groupError } = await supabase
          .from('groups')
          .select('id, name, invite_code, festival_id, festivals(id, name, year, emoji, color)')
          .eq('id', groupId)
          .single();

        if (groupError) throw groupError;

        const g = groupData as any;
        const mappedGroup: GroupData = {
          id: g.id,
          name: g.name,
          invite_code: g.invite_code,
          festival_id: g.festival_id,
          festival_name: g.festivals?.name ?? 'Festival',
          festival_year: g.festivals?.year ?? new Date().getFullYear(),
          festival_emoji: g.festivals?.emoji ?? '🎪',
          festival_color: g.festivals?.color ?? '#e85d26',
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
            .select('id, display_name')
            .in('id', memberIds);

          if (profilesError) throw profilesError;

          profilesById = Object.fromEntries(
            (profilesData ?? []).map((p: any) => [p.id, { display_name: p.display_name }])
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
          .select('id, start_time, end_time, day_date, stages(name), artists(name)')
          .in('id', uniquePerfIds)
          .eq('festival_id', mappedGroup.festival_id);

        if (perfError) throw perfError;

        const perfMap: Record<number, PerformanceInfo> = {};
        perfData?.forEach((p: any) => {
          perfMap[p.id] = {
            id: p.id,
            artist_name: p.artists?.name ?? '',
            stage_name: p.stages?.name ?? '',
            start_time: p.start_time,
            end_time: p.end_time,
            day_date: p.day_date
          };
        });
        setPerformances(perfMap);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Could not load group schedule.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [groupId, supabase, user, router]);

  const schedule = useMemo(() => {
    const result: Record<string, { perf: PerformanceInfo; attendees: string[]; maybes: string[] }> = {};

    performancePrefs.forEach((pref) => {
      const perf = performances[pref.performance_id];
      if (!perf) return;
      const key = `${perf.day_date}__${perf.start_time}__${perf.stage_name}__${perf.id}`;
      if (!result[key]) result[key] = { perf, attendees: [], maybes: [] };
      if (pref.status === 'going') result[key].attendees.push(pref.user_label);
      if (pref.status === 'maybe') result[key].maybes.push(pref.user_label);
    });

    return result;
  }, [performancePrefs, performances]);

  const sortedKeys = Object.keys(schedule).sort();

  const copyInviteCode = async () => {
    if (!group?.invite_code) return;
    await navigator.clipboard.writeText(group.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const shareToWhatsApp = () => {
    if (!group) return;
    const message = `Join my Lineup-Mate group "${group.name}" for ${group.festival_name} ${group.festival_year}. Invite code: ${group.invite_code}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  const handleLeaveOrDelete = async () => {
    if (!user || !group) return;
    setLeaving(true);
    setError(null);

    try {
      if (myRole === 'owner') {
        const { error } = await supabase.from('groups').delete().eq('id', group.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('group_members')
          .delete()
          .eq('group_id', group.id)
          .eq('user_id', user.id);
        if (error) throw error;
      }
      router.push('/groups');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not leave the group.');
      setLeaving(false);
      setConfirmLeave(false);
    }
  };

  return (
    <>
      <Navbar />
      <main style={{ minHeight: '100vh', background: c.bg, color: c.txt }}>
        <section className="mx-auto max-w-6xl px-4 py-8">

          <header className="mb-6 overflow-hidden rounded-[28px] shadow-2xl" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
            {group && <div className="h-2" style={{ background: group.festival_color }} />}
            <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                {group && (
                  <button
                    type="button"
                    onClick={() => router.push(`/festival/${group.festival_id}`)}
                    className="mb-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black"
                    style={{ background: `${group.festival_color}22`, color: group.festival_color, border: `1px solid ${group.festival_color}44` }}
                    data-testid="group-festival-link"
                  >
                    {group.festival_emoji} {group.festival_name} {group.festival_year}
                  </button>
                )}
                <p className="text-xs font-extrabold uppercase tracking-widest" style={{ color: c.acc }}>Group Schedule</p>
                <h1 className="text-4xl font-black" style={{ fontFamily: 'Syne, Nunito, sans-serif' }}>
                  {group ? group.name : 'Loading…'}
                </h1>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => router.push('/groups')}
                  className="rounded-full px-4 py-2 text-sm font-black"
                  style={{ background: c.surf2, border: `1px solid ${c.brd}`, color: c.txt }}
                  data-testid="back-to-groups"
                >
                  ← My Groups
                </button>

                {group && !confirmLeave && (
                  <button
                    type="button"
                    onClick={() => setConfirmLeave(true)}
                    className="rounded-full px-4 py-2 text-sm font-black"
                    style={{ background: c.surf2, border: '1px solid #dc262640', color: '#dc2626' }}
                    data-testid="leave-group-btn"
                  >
                    {myRole === 'owner' ? 'Delete Group' : 'Leave Group'}
                  </button>
                )}

                {confirmLeave && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold" style={{ color: c.muted }}>
                      {myRole === 'owner' ? 'Delete group for everyone?' : 'Leave this group?'}
                    </span>
                    <button
                      type="button"
                      disabled={leaving}
                      onClick={handleLeaveOrDelete}
                      className="rounded-full px-3 py-1.5 text-xs font-black text-white disabled:opacity-60"
                      style={{ background: '#dc2626' }}
                      data-testid="confirm-leave-btn"
                    >
                      {leaving ? 'Please wait…' : myRole === 'owner' ? 'Yes, delete' : 'Yes, leave'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmLeave(false)}
                      className="rounded-full px-3 py-1.5 text-xs font-black"
                      style={{ background: c.surf2, border: `1px solid ${c.brd}`, color: c.muted }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
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
                  <code
                    className="flex-1 rounded-2xl px-4 py-3 text-sm font-black"
                    style={{ background: c.surf2, color: c.txt, border: `1px solid ${c.brd}` }}
                    data-testid="invite-code"
                  >
                    {group.invite_code}
                  </code>
                  <button
                    type="button"
                    onClick={copyInviteCode}
                    className="rounded-full px-4 py-3 text-sm font-black text-white"
                    style={{ background: copied ? '#16a34a' : c.accB }}
                    data-testid="copy-invite-code"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={shareToWhatsApp}
                  className="mt-3 w-full rounded-2xl px-4 py-2.5 text-sm font-black"
                  style={{ background: c.surf2, border: `1px solid ${c.brd}`, color: c.txt }}
                  data-testid="share-whatsapp"
                >
                  Share via WhatsApp
                </button>
              </div>

              <div className="rounded-[28px] p-5" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
                <h2 className="mb-3 font-black">Members ({members.length})</h2>
                {members.length === 0 ? (
                  <p className="text-sm" style={{ color: c.muted }}>No members yet.</p>
                ) : (
                  <ul className="space-y-2" data-testid="members-list">
                    {members.map((member) => (
                      <li
                        key={member.user_id}
                        className="flex items-center justify-between rounded-2xl px-3 py-2"
                        style={{ background: c.surf2 }}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-black"
                            style={{ background: `${c.acc}33`, color: c.acc }}
                          >
                            {memberLabel(member).slice(0, 1).toUpperCase()}
                          </div>
                          <span className="text-sm font-bold">{memberLabel(member)}</span>
                        </div>
                        <span
                          className="rounded-full px-2 py-0.5 text-xs font-black capitalize"
                          style={{ background: c.surf, color: c.muted, border: `1px solid ${c.brd}` }}
                        >
                          {member.role}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {!loading && !error && sortedKeys.length === 0 && group && (
            <div className="rounded-[28px] p-8 text-center" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
              <div className="text-5xl">🎶</div>
              <h2 className="mt-3 text-2xl font-black">No preferences yet</h2>
              <p className="mt-2 text-sm" style={{ color: c.muted }}>
                Group members haven't starred any acts yet.
              </p>
              <button
                type="button"
                onClick={() => router.push(`/festival/${group.festival_id}`)}
                className="mt-5 rounded-full px-5 py-3 text-sm font-black text-white"
                style={{ background: `linear-gradient(135deg, ${group.festival_color}, ${c.accB})` }}
              >
                Open Festival & Star Acts
              </button>
            </div>
          )}

          {!loading && sortedKeys.length > 0 && (
            <div className="overflow-hidden rounded-[28px] shadow-xl" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
              <div className="overflow-x-auto scroll-thin">
                <table className="min-w-full" data-testid="shared-schedule-table">
                  <thead>
                    <tr style={{ background: c.surf2, borderBottom: `1px solid ${c.brd}` }}>
                      <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-widest" style={{ color: c.muted }}>Date</th>
                      <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-widest" style={{ color: c.muted }}>Time</th>
                      <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-widest" style={{ color: c.muted }}>Stage</th>
                      <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-widest" style={{ color: c.muted }}>Artist</th>
                      <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-widest" style={{ color: '#ffd166' }}>★ Going</th>
                      <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-widest" style={{ color: c.acc }}>Maybe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedKeys.map((key, idx) => {
                      const { perf, attendees, maybes } = schedule[key];
                      return (
                        <tr
                          key={key}
                          style={{ borderTop: idx === 0 ? 'none' : `1px solid ${c.brd}` }}
                          className="transition hover:opacity-80"
                        >
                          <td className="px-4 py-3 text-xs font-bold" style={{ color: c.muted }}>
                            {new Date(perf.day_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                          </td>
                          <td className="px-4 py-3 text-sm font-bold" style={{ color: c.txt }}>
                            {new Date(perf.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-4 py-3 text-sm" style={{ color: c.muted }}>{perf.stage_name}</td>
                          <td className="px-4 py-3 text-sm font-black" style={{ color: c.txt }}>{perf.artist_name}</td>
                          <td className="px-4 py-3 text-sm font-bold" style={{ color: '#ffd166' }}>
                            {attendees.length > 0 ? attendees.join(', ') : <span style={{ color: c.muted }}>—</span>}
                          </td>
                          <td className="px-4 py-3 text-sm font-bold" style={{ color: c.acc }}>
                            {maybes.length > 0 ? maybes.join(', ') : <span style={{ color: c.muted }}>—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
