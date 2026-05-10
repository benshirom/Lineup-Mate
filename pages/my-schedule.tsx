import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/lib/AuthContext';
import { getThemeColors, type ThemeMode } from '@/lib/platform';

type PreferenceStatus = 'going' | 'maybe' | 'not_interested';

interface ScheduleItem {
  preferenceId: number;
  performanceId: number;
  status: PreferenceStatus;
  startTime: string;
  endTime: string;
  dayDate: string;
  artistName: string;
  stageName: string;
  stageColor: string;
  festivalId: number;
  festivalName: string;
  festivalYear: number;
  festivalEmoji: string;
  festivalColor: string;
  festivalLocation: string | null;
}

function timeLabel(dateString: string) {
  return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function dateLabel(dateString: string) {
  return new Date(dateString).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  });
}

export default function MySchedulePage() {
  const router = useRouter();
  const { user, supabase } = useAuth();
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [theme] = useState<ThemeMode>('dark');

  const c = getThemeColors(theme);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    const loadSchedule = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error } = await supabase
          .from('user_performance_preferences')
          .select(`
            id,
            performance_id,
            status,
            performances(
              id,
              start_time,
              end_time,
              day_date,
              festivals(id, name, year, emoji, color, location),
              stages(name, color),
              artists(name)
            )
          `)
          .eq('user_id', user.id)
          .in('status', ['going', 'maybe'])
          .order('updated_at', { ascending: false });

        if (error) throw error;

        const mapped = (data || [])
          .map((row: any): ScheduleItem | null => {
            const performance = row.performances;
            if (!performance) return null;

            return {
              preferenceId: row.id,
              performanceId: row.performance_id,
              status: row.status,
              startTime: performance.start_time,
              endTime: performance.end_time,
              dayDate: performance.day_date,
              artistName: performance.artists?.name || 'Unknown Artist',
              stageName: performance.stages?.name || 'Stage',
              stageColor: performance.stages?.color || performance.festivals?.color || '#e85d26',
              festivalId: performance.festivals?.id,
              festivalName: performance.festivals?.name || 'Festival',
              festivalYear: performance.festivals?.year || new Date(performance.start_time).getFullYear(),
              festivalEmoji: performance.festivals?.emoji || '🎪',
              festivalColor: performance.festivals?.color || '#e85d26',
              festivalLocation: performance.festivals?.location || null
            };
          })
          .filter(Boolean) as ScheduleItem[];

        mapped.sort((a, b) => a.startTime.localeCompare(b.startTime));
        setItems(mapped);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Could not load your schedule.');
      } finally {
        setLoading(false);
      }
    };

    loadSchedule();
  }, [router, supabase, user]);

  const groupedItems = useMemo(() => {
    const result: Record<string, ScheduleItem[]> = {};

    items.forEach((item) => {
      const key = `${item.festivalName} ${item.festivalYear}__${item.dayDate}`;
      if (!result[key]) result[key] = [];
      result[key].push(item);
    });

    return Object.entries(result).map(([key, groupItems]) => ({
      key,
      festival: `${groupItems[0].festivalEmoji} ${groupItems[0].festivalName} ${groupItems[0].festivalYear}`,
      festivalId: groupItems[0].festivalId,
      festivalColor: groupItems[0].festivalColor,
      dayDate: groupItems[0].dayDate,
      items: groupItems
    }));
  }, [items]);

  const removeItem = async (item: ScheduleItem) => {
    if (!user) return;

    setRemovingId(item.performanceId);

    try {
      const { error } = await supabase.rpc('upsert_user_preference', {
        p_user_id: user.id,
        p_performance_id: item.performanceId,
        p_status: null
      });

      if (error) throw error;
      setItems((current) => current.filter((currentItem) => currentItem.performanceId !== item.performanceId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not remove this item.');
    } finally {
      setRemovingId(null);
    }
  };

  const clearSchedule = async () => {
    if (!user || items.length === 0) return;

    const approved = window.confirm('Remove all saved acts from your schedule?');
    if (!approved) return;

    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('user_performance_preferences')
        .delete()
        .eq('user_id', user.id)
        .in('status', ['going', 'maybe']);

      if (error) throw error;
      setItems([]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not clear your schedule.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <main style={{ minHeight: '100vh', background: c.bg, color: c.txt }}>
        <section className="mx-auto max-w-5xl px-4 py-8">
          <header className="mb-6 rounded-[28px] p-6 shadow-2xl" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest" style={{ color: c.acc }}>Lineup·Mate</p>
                <h1 className="text-4xl font-black" style={{ fontFamily: 'Syne, Nunito, sans-serif' }}>My Schedule</h1>
                <p className="mt-2 text-sm" style={{ color: c.muted }}>
                  All the acts you marked with a star, organized by festival and day.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => router.push('/')}
                  className="rounded-full px-4 py-2 text-sm font-black"
                  style={{ background: c.surf2, border: `1px solid ${c.brd}`, color: c.txt }}
                >
                  Browse Events
                </button>
                {items.length > 0 && (
                  <button
                    type="button"
                    onClick={clearSchedule}
                    className="rounded-full px-4 py-2 text-sm font-black text-white"
                    style={{ background: '#dc2626' }}
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>
          </header>

          {loading && <p style={{ color: c.muted }}>Loading your schedule…</p>}
          {error && <p className="mb-4 rounded-xl p-4 text-sm text-red-700" style={{ background: '#fee2e2', border: '1px solid #fecaca' }}>{error}</p>}

          {!loading && items.length === 0 && !error && (
            <div className="rounded-[28px] p-8 text-center" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
              <div className="text-5xl">☆</div>
              <h2 className="mt-3 text-2xl font-black">No saved acts yet</h2>
              <p className="mt-2 text-sm" style={{ color: c.muted }}>
                Open a festival and tap the star next to artists you do not want to miss.
              </p>
              <button
                type="button"
                onClick={() => router.push('/')}
                className="mt-5 rounded-full px-5 py-3 text-sm font-black text-white"
                style={{ background: `linear-gradient(135deg, ${c.acc}, ${c.accB})` }}
              >
                Find Festivals
              </button>
            </div>
          )}

          <div className="space-y-5">
            {groupedItems.map((group) => (
              <section key={group.key} className="overflow-hidden rounded-[28px] shadow-xl" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
                <div className="h-2" style={{ background: group.festivalColor }} />
                <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-black">{group.festival}</h2>
                    <p className="text-sm" style={{ color: c.muted }}>{dateLabel(group.dayDate)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push(`/festival/${group.festivalId}`)}
                    className="rounded-full px-4 py-2 text-sm font-black text-white"
                    style={{ background: group.festivalColor }}
                  >
                    Open Festival
                  </button>
                </div>

                <div className="divide-y" style={{ borderColor: c.brd }}>
                  {group.items.map((item) => (
                    <article key={item.performanceId} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl" style={{ background: `${item.stageColor}22`, color: item.stageColor }}>
                          ★
                        </div>
                        <div>
                          <h3 className="font-black">{item.artistName}</h3>
                          <p className="text-sm" style={{ color: c.muted }}>
                            {timeLabel(item.startTime)} – {timeLabel(item.endTime)} · <span style={{ color: item.stageColor }}>{item.stageName}</span>
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={removingId === item.performanceId}
                        onClick={() => removeItem(item)}
                        className="rounded-full px-4 py-2 text-sm font-black disabled:opacity-60"
                        style={{ background: c.surf2, border: `1px solid ${c.brd}`, color: c.muted }}
                      >
                        {removingId === item.performanceId ? 'Removing…' : 'Remove'}
                      </button>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
