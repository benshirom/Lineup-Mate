import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/lib/AuthContext';
import LineupTable, { LineupPerformance } from '@/components/LineupTable';

interface Stage {
  id: number;
  name: string;
}

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

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (!festivalId) return;
    const loadData = async () => {
      setLoading(true);
      // Fetch festival
      const { data: festivalData } = await supabase
        .from('festivals')
        .select('*')
        .eq('id', festivalId)
        .single();
      setFestival(festivalData as Festival);
      // Fetch performances with joined stage and artist names
      const { data: performancesData, error: perfError } = await supabase
        .from('performances')
        .select(
          'id, start_time, end_time, day_date, stage_id, artist_id, stages(name), artists(name)'
        )
        .eq('festival_id', festivalId)
        .order('start_time');
      if (perfError) {
        console.error(perfError);
        setLoading(false);
        return;
      }
      const performances = performancesData ?? [];
      // Fetch user preferences
      const { data: prefs } = await supabase
        .from('user_performance_preferences')
        .select('performance_id,status')
        .eq('user_id', user.id);
      const prefMap: Record<number, any> = {};
      prefs?.forEach((p) => {
        prefMap[p.performance_id] = p.status;
      });
      // Determine unique days
      const uniqueDays = Array.from(
        new Set(performances.map((p: any) => p.day_date as string))
      ).sort();
      setDays(uniqueDays);
      setSelectedDay(uniqueDays[0]);
      // Group by stage for selected day later
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
      setLoading(false);
    };
    loadData();
  }, [festivalId, supabase, user, router]);

  const getStagesForDay = (day: string) => {
    return Object.keys(lineupByStage)
      .filter((key) => key.startsWith(day + '__'))
      .map((key) => key.split('__')[1]);
  };
  const getLineupForDayAndStage = (day: string, stage: string) => {
    return lineupByStage[`${day}__${stage}`] || [];
  };

  return (
    <>
      <Navbar />
      <main className="p-4 max-w-5xl mx-auto">
        {festival && (
          <h1 className="text-2xl font-bold mb-4">
            {festival.name} {festival.year}
          </h1>
        )}

        {/* Create group button */}
        {!loading && festival && (
          <div className="mb-4">
            <button
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              onClick={async () => {
                const groupName = prompt('Enter a name for your group');
                if (!groupName) return;
                try {
                  // Create group
                  const { data: newGroup, error } = await supabase
                    .from('groups')
                    .insert({ festival_id: festival.id, name: groupName, owner_user_id: user?.id })
                    .select()
                    .single();
                  if (error) throw error;
                  // Add creator as member
                  await supabase.from('group_members').insert({ group_id: newGroup.id, user_id: user?.id });
                  router.push(`/group/${newGroup.id}`);
                } catch (err: any) {
                  alert(err.message);
                }
              }}
            >
              Create Group
            </button>
          </div>
        )}
        {loading && <p>Loading lineup…</p>}
        {!loading && days.length > 0 && (
          <>
            <div className="flex gap-2 mb-4 overflow-x-auto">
              {days.map((day) => (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={
                    'px-4 py-2 rounded ' +
                    (selectedDay === day ? 'bg-blue-600 text-white' : 'bg-gray-200')
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
            {getStagesForDay(selectedDay).map((stage) => (
              <div key={stage} className="mb-6">
                <h2 className="text-xl font-semibold mb-2">{stage}</h2>
                <LineupTable performances={getLineupForDayAndStage(selectedDay, stage)} />
              </div>
            ))}
          </>
        )}
        {!loading && days.length === 0 && <p>No performances found.</p>}
      </main>
    </>
  );
}