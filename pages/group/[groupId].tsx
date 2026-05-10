import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/lib/AuthContext';

interface GroupMember {
  user_id: string;
  role: 'owner' | 'member';
  profiles?: {
    email?: string | null;
    display_name?: string | null;
  } | null;
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
}

export default function GroupPage() {
  const router = useRouter();
  const { groupId } = router.query;
  const { user, supabase } = useAuth();
  const [group, setGroup] = useState<GroupData | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [performancePrefs, setPerformancePrefs] = useState<GroupMemberPref[]>([]);
  const [performances, setPerformances] = useState<Record<number, PerformanceInfo>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    if (!groupId) return;

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: groupData, error: groupError } = await supabase
          .from('groups')
          .select('id, name, invite_code')
          .eq('id', groupId)
          .single();

        if (groupError) throw groupError;
        setGroup(groupData as GroupData);

        const { data: memberData, error: membersError } = await supabase
          .from('group_members')
          .select('user_id, role, profiles(email, display_name)')
          .eq('group_id', groupId);

        if (membersError) throw membersError;

        const memberList = (memberData ?? []) as GroupMember[];
        setMembers(memberList);

        const memberIds = memberList.map((m) => m.user_id);
        if (memberIds.length === 0) {
          setPerformancePrefs([]);
          setPerformances({});
          return;
        }

        const { data: prefs, error: prefsError } = await supabase
          .from('user_performance_preferences')
          .select('performance_id,status,user_id')
          .in('user_id', memberIds)
          .neq('status', null);

        if (prefsError) throw prefsError;

        const prefWithProfile: GroupMemberPref[] = (prefs ?? []).map((p: any) => {
          const matchingMember = memberList.find((m) => m.user_id === p.user_id);
          const label =
            matchingMember?.profiles?.display_name ||
            matchingMember?.profiles?.email ||
            p.user_id.slice(0, 8);

          return {
            performance_id: p.performance_id,
            status: p.status,
            user_id: p.user_id,
            user_label: label
          };
        });

        setPerformancePrefs(prefWithProfile);

        const uniquePerfIds = Array.from(new Set((prefs ?? []).map((p: any) => p.performance_id)));
        if (uniquePerfIds.length === 0) {
          setPerformances({});
          return;
        }

        const { data: perfData, error: perfError } = await supabase
          .from('performances')
          .select('id, start_time, end_time, day_date, stages(name), artists(name)')
          .in('id', uniquePerfIds);

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
        const message = err instanceof Error ? err.message : 'Could not load group schedule.';
        setError(message);
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
      if (!result[key]) {
        result[key] = { perf, attendees: [], maybes: [] };
      }

      if (pref.status === 'going') {
        result[key].attendees.push(pref.user_label);
      }

      if (pref.status === 'maybe') {
        result[key].maybes.push(pref.user_label);
      }
    });

    return result;
  }, [performancePrefs, performances]);

  const sortedKeys = Object.keys(schedule).sort();

  const copyInviteCode = async () => {
    if (!group?.invite_code) return;
    await navigator.clipboard.writeText(group.invite_code);
  };

  return (
    <>
      <Navbar />
      <main className="p-4 max-w-6xl mx-auto">
        <div className="mb-6">
          <p className="text-sm uppercase tracking-wide text-blue-600 font-semibold">Group schedule</p>
          <h1 className="text-3xl font-bold text-gray-900">{group ? group.name : 'Group'}</h1>
        </div>

        {loading && <p>Loading group schedule…</p>}
        {error && <p className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 p-3">{error}</p>}

        {!loading && group && (
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="border border-gray-200 rounded-xl bg-white p-4 shadow-sm">
              <h2 className="font-semibold text-gray-900 mb-2">Invite friends</h2>
              <p className="text-sm text-gray-600 mb-3">Share this code so friends can join from the festival page.</p>
              <div className="flex gap-2">
                <code className="flex-1 rounded-lg bg-gray-100 px-3 py-2 text-sm font-mono">{group.invite_code}</code>
                <button type="button" onClick={copyInviteCode} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                  Copy
                </button>
              </div>
            </div>

            <div className="border border-gray-200 rounded-xl bg-white p-4 shadow-sm">
              <h2 className="font-semibold text-gray-900 mb-2">Members</h2>
              {members.length === 0 ? (
                <p className="text-sm text-gray-600">No members yet.</p>
              ) : (
                <ul className="space-y-2">
                  {members.map((member) => (
                    <li key={member.user_id} className="flex justify-between text-sm border-b border-gray-100 pb-2 last:border-b-0">
                      <span>{member.profiles?.display_name || member.profiles?.email || member.user_id.slice(0, 8)}</span>
                      <span className="text-gray-500 capitalize">{member.role}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        {!loading && !error && sortedKeys.length === 0 && <p>No preferences set for this group yet.</p>}

        {!loading && sortedKeys.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Time</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Stage</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Artist</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Going</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Maybe</th>
                </tr>
              </thead>
              <tbody>
                {sortedKeys.map((key) => {
                  const { perf, attendees, maybes } = schedule[key];
                  return (
                    <tr key={key} className="border-t border-gray-100">
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {new Date(perf.day_date).toLocaleDateString(undefined, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {new Date(perf.start_time).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{perf.stage_name}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{perf.artist_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{attendees.length > 0 ? attendees.join(', ') : '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{maybes.length > 0 ? maybes.join(', ') : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
