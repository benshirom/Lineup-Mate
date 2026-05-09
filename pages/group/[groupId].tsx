import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/lib/AuthContext';

interface GroupMemberPref {
  performance_id: number;
  status: string;
  user_id: string;
  user_email: string;
}

interface PerformanceInfo {
  id: number;
  artist_name: string;
  stage_name: string;
  start_time: string;
  end_time: string;
  day_date: string;
}

export default function GroupPage() {
  const router = useRouter();
  const { groupId } = router.query;
  const { user, supabase } = useAuth();
  const [groupName, setGroupName] = useState('');
  const [members, setMembers] = useState<any[]>([]);
  const [performancePrefs, setPerformancePrefs] = useState<GroupMemberPref[]>([]);
  const [performances, setPerformances] = useState<Record<number, PerformanceInfo>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (!groupId) return;
    const loadData = async () => {
      setLoading(true);
      // Fetch group and members
      const { data: groupData } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single();
      setGroupName(groupData?.name ?? '');
      const { data: memberData } = await supabase
        .from('group_members')
        .select('user_id, users(email)')
        .eq('group_id', groupId);
      const memberList = memberData?.map((m) => ({ id: m.user_id, email: m.users?.email })) ?? [];
      setMembers(memberList);
      // Fetch preferences of group members
      const memberIds = memberList.map((m) => m.id);
      const { data: prefs } = await supabase
        .from('user_performance_preferences')
        .select('performance_id,status,user_id')
        .in('user_id', memberIds)
        .neq('status', null);
      const prefWithEmail: GroupMemberPref[] = (prefs ?? []).map((p) => ({
        performance_id: p.performance_id,
        status: p.status,
        user_id: p.user_id,
        user_email: memberList.find((m) => m.id === p.user_id)?.email ?? ''
      }));
      setPerformancePrefs(prefWithEmail);
      // Fetch performance info
      const uniquePerfIds = Array.from(new Set(prefs?.map((p) => p.performance_id)));
      if (uniquePerfIds.length > 0) {
        const { data: perfData } = await supabase
          .from('performances')
          .select('id, start_time, end_time, day_date, stages(name), artists(name)')
          .in('id', uniquePerfIds);
        const perfMap: Record<number, PerformanceInfo> = {};
        perfData?.forEach((p) => {
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
      }
      setLoading(false);
    };
    loadData();
  }, [groupId, supabase, user, router]);

  // Build schedule grouped by day and stage
  const schedule: Record<string, { perf: PerformanceInfo; attendees: string[] }> = {};
  performancePrefs.forEach((pref) => {
    if (!performances[pref.performance_id]) return;
    const perf = performances[pref.performance_id];
    const key = `${perf.day_date}__${perf.start_time}__${perf.stage_name}`;
    if (!schedule[key]) {
      schedule[key] = { perf, attendees: [] };
    }
    if (pref.status === 'going') {
      schedule[key].attendees.push(pref.user_email);
    }
  });
  // Sort schedule by date/time
  const sortedKeys = Object.keys(schedule).sort();

  return (
    <>
      <Navbar />
      <main className="p-4 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Group: {groupName}</h1>
        {loading && <p>Loading group schedule…</p>}
        {!loading && sortedKeys.length === 0 && <p>No preferences set for this group yet.</p>}
        {!loading && sortedKeys.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 border">Date</th>
                  <th className="px-4 py-2 border">Time</th>
                  <th className="px-4 py-2 border">Stage</th>
                  <th className="px-4 py-2 border">Artist</th>
                  <th className="px-4 py-2 border">Attendees</th>
                </tr>
              </thead>
              <tbody>
                {sortedKeys.map((key) => {
                  const { perf, attendees } = schedule[key];
                  return (
                    <tr key={key} className="border-t">
                      <td className="px-4 py-2 border">
                        {new Date(perf.day_date).toLocaleDateString(undefined, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </td>
                      <td className="px-4 py-2 border">
                        {new Date(perf.start_time).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="px-4 py-2 border">{perf.stage_name}</td>
                      <td className="px-4 py-2 border">{perf.artist_name}</td>
                      <td className="px-4 py-2 border">
                        {attendees.length > 0 ? attendees.join(', ') : 'None'}
                      </td>
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