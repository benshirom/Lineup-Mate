import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/lib/AuthContext';
import LineupTable, { LineupPerformance } from '@/components/LineupTable';

interface Festival {
  id: number;
  name: string;
  year: number;
}

export default function FestivalPage() {
  const router = useRouter();
  const { festivalId } = router.query;
  const { user, supabase } = useAuth();
  const [festival, setFestival] = useState<Festival | null>(null);
  const [days, setDays] = useState<string[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [lineupByStage, setLineupByStage] = useState<Record<string, LineupPerformance[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

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

        const { data: performancesData, error: perfError } = await supabase
          .from('performances')
          .select('id, start_time, end_time, day_date, stage_id, artist_id, stages(name), artists(name)')
          .eq('festival_id', festivalId)
          .order('start_time');

        if (perfError) throw perfError;

        const { data: prefs, error: prefsError } = await supabase
          .from('user_performance_preferences')
          .select('performance_id,status')
          .eq('user_id', user.id);

        if (prefsError) throw prefsError;

        const prefMap: Record<number, LineupPerformance['status']> = {};
        prefs?.forEach((p) => {
          prefMap[p.performance_id] = p.status;
        });

        const performances = performancesData ?? [];
        const uniqueDays = Array.from(new Set(performances.map((p: any) => p.day_date as string))).sort();
        setDays(uniqueDays);
        setSelectedDay((current) => current || uniqueDays[0] || '');

        const grouped: Record<string, LineupPerformance[]> = {};
        performances.forEach((p: any) => {
          const day = p.day_date;
          const stageName = p.stages?.name ?? 'Stage';
          const key = `${day}__${stageName}`;

          if (!grouped[key]) grouped[key] = [];
          grouped[key].push({
            id: p.id,
            artist_name: p.artists?.name ?? 'Unknown',
            stage_name: stageName,
            start_time: p.start_time,
            end_time: p.end_time,
            status: prefMap[p.id] ?? null
          });
        });

        setLineupByStage(grouped);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Could not load festival data.';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [festivalId, supabase, user, router]);

  const stagesForSelectedDay = useMemo(() => {
    return Object.keys(lineupByStage)
      .filter((key) => key.startsWith(selectedDay + '__'))
      .map((key) => key.split('__')[1]);
  }, [lineupByStage, selectedDay]);

  const getLineupForDayAndStage = (day: string, stage: string) => {
    return lineupByStage[`${day}__${stage}`] || [];
  };

  const handleCreateGroup = async () => {
    if (!festival || !user) return;

    const groupName = window.prompt('Enter a name for your group');
    if (!groupName?.trim()) return;

    setCreatingGroup(true);
    setError(null);

    try {
      const { data: newGroup, error: groupError } = await supabase
        .from('groups')
        .insert({ festival_id: festival.id, name: groupName.trim(), owner_user_id: user.id })
        .select()
        .single();

      if (groupError) throw groupError;

      const { error: memberError } = await supabase
        .from('group_members')
        .insert({ group_id: newGroup.id, user_id: user.id, role: 'owner' });

      if (memberError) throw memberError;

      router.push(`/group/${newGroup.id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not create group.';
      setError(message);
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError(null);

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
      const message = err instanceof Error ? err.message : 'Could not join group.';
      setJoinError(message);
    }
  };

  return (
    <>
      <Navbar />
      <main className="p-4 max-w-6xl mx-auto">
        {festival && (
          <div className="mb-6">
            <p className="text-sm uppercase tracking-wide text-blue-600 font-semibold">Lineup-Mate</p>
            <h1 className="text-3xl font-bold text-gray-900">
              {festival.name} {festival.year}
            </h1>
          </div>
        )}

        {!loading && festival && (
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="border border-gray-200 rounded-xl bg-white p-4 shadow-sm">
              <h2 className="font-semibold text-gray-900 mb-2">Create a group</h2>
              <p className="text-sm text-gray-600 mb-4">
                Open a shared schedule and invite friends to compare who is going to each act.
              </p>
              <button
                type="button"
                disabled={creatingGroup}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-60"
                onClick={handleCreateGroup}
              >
                {creatingGroup ? 'Creating…' : 'Create Group'}
              </button>
            </div>

            <form onSubmit={handleJoinGroup} className="border border-gray-200 rounded-xl bg-white p-4 shadow-sm">
              <h2 className="font-semibold text-gray-900 mb-2">Join a group</h2>
              <p className="text-sm text-gray-600 mb-4">Paste an invite code from a friend.</p>
              <div className="flex gap-2">
                <input
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="Invite code"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                  Join
                </button>
              </div>
              {joinError && <p className="text-sm text-red-600 mt-2">{joinError}</p>}
            </form>
          </section>
        )}

        {loading && <p>Loading lineup…</p>}
        {error && <p className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 p-3">{error}</p>}

        {!loading && days.length > 0 && (
          <>
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
              {days.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  className={
                    'px-4 py-2 rounded-full border whitespace-nowrap ' +
                    (selectedDay === day
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50')
                  }
                >
                  {new Date(day).toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric'
                  })}
                </button>
              ))}
            </div>

            {stagesForSelectedDay.map((stage) => (
              <section key={stage} className="mb-8">
                <h2 className="text-xl font-semibold mb-3 text-gray-900">{stage}</h2>
                <LineupTable performances={getLineupForDayAndStage(selectedDay, stage)} />
              </section>
            ))}
          </>
        )}

        {!loading && days.length === 0 && !error && <p>No performances found.</p>}
      </main>
    </>
  );
}
