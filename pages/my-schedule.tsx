import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/lib/AuthContext';
import { formatDateRange, getThemeColors } from '@/lib/platform';

type PreferenceStatus = 'going' | 'maybe' | 'not_interested';

interface SavedFestivalItem {
  savedId: number;
  festivalId: number;
  name: string;
  year: number;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  emoji: string;
  color: string;
  genreLabel: string | null;
  createdAt: string;
}

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

interface FestivalScheduleGroup {
  festivalId: number;
  festival: string;
  festivalColor: string;
  festivalEmoji: string;
  days: Array<{
    dayDate: string;
    items: ScheduleItem[];
  }>;
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

function festivalTitle(name: string, year: number) {
  return name.includes(String(year)) ? name : `${name} ${year}`;
}

export default function MySchedulePage() {
  const router = useRouter();
  const { user, authReady, supabase, theme } = useAuth();
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [savedFestivals, setSavedFestivals] = useState<SavedFestivalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [removingFestivalId, setRemovingFestivalId] = useState<number | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const c = getThemeColors(theme);

  useEffect(() => {
    if (!authReady) return;

    if (!user) {
      setLoading(false);
      router.push('/login');
      return;
    }

    const loadSchedule = async () => {
      setLoading(true);
      setError(null);

      try {
        const [savedFestivalsResult, preferencesResult] = await Promise.all([
          supabase
            .from('saved_festivals')
            .select(`
              id,
              created_at,
              festival_id,
              festivals(id, name, year, emoji, color, location, start_date, end_date, genre_label)
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false }),
          supabase
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
            .order('updated_at', { ascending: false })
        ]);

        if (savedFestivalsResult.error) throw savedFestivalsResult.error;
        if (preferencesResult.error) throw preferencesResult.error;

        const mappedFestivals = (savedFestivalsResult.data || [])
          .map((row: any): SavedFestivalItem | null => {
            const festival = row.festivals;
            if (!festival) return null;
            return {
              savedId: row.id,
              festivalId: festival.id,
              name: festival.name || 'Festival',
              year: festival.year || new Date().getFullYear(),
              location: festival.location || null,
              startDate: festival.start_date || null,
              endDate: festival.end_date || null,
              emoji: festival.emoji || '🎪',
              color: festival.color || '#e85d26',
              genreLabel: festival.genre_label || null,
              createdAt: row.created_at
            };
          })
          .filter(Boolean) as SavedFestivalItem[];

        setSavedFestivals(mappedFestivals);

        const mapped = (preferencesResult.data || [])
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
  }, [authReady, router, supabase, user]);

  const groupedItems = useMemo((): FestivalScheduleGroup[] => {
    const festivalGroups = new Map<number, FestivalScheduleGroup>();

    items.forEach((item) => {
      if (!festivalGroups.has(item.festivalId)) {
        festivalGroups.set(item.festivalId, {
          festivalId: item.festivalId,
          festival: festivalTitle(item.festivalName, item.festivalYear),
          festivalColor: item.festivalColor,
          festivalEmoji: item.festivalEmoji,
          days: []
        });
      }

      const festivalGroup = festivalGroups.get(item.festivalId)!;
      let dayGroup = festivalGroup.days.find((group) => group.dayDate === item.dayDate);
      if (!dayGroup) {
        dayGroup = { dayDate: item.dayDate, items: [] };
        festivalGroup.days.push(dayGroup);
      }
      dayGroup.items.push(item);
    });

    return Array.from(festivalGroups.values()).map((group) => ({
      ...group,
      days: group.days
        .map((dayGroup) => ({ ...dayGroup, items: dayGroup.items.sort((a, b) => a.startTime.localeCompare(b.startTime)) }))
        .sort((a, b) => a.dayDate.localeCompare(b.dayDate))
    }));
  }, [items]);

  const openFestival = (festivalId: number, dayDate?: string) => {
    const dayQuery = dayDate ? `?day=${dayDate}` : '';
    router.push(`/festival/${festivalId}${dayQuery}`);
  };

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

  const removeSavedFestival = async (festival: SavedFestivalItem) => {
    if (!user) return;
    setRemovingFestivalId(festival.festivalId);

    try {
      const { error } = await supabase
        .from('saved_festivals')
        .delete()
        .eq('user_id', user.id)
        .eq('festival_id', festival.festivalId);

      if (error) throw error;
      setSavedFestivals((current) => current.filter((item) => item.festivalId !== festival.festivalId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not remove this festival.');
    } finally {
      setRemovingFestivalId(null);
    }
  };

  const clearSchedule = async () => {
    if (!user || items.length === 0) return;

    setLoading(true);
    setError(null);
    setConfirmClear(false);

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
        <section className="mx-auto max-w-6xl px-4 py-8">
          <header className="mb-6 rounded-[28px] p-6 shadow-2xl" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest" style={{ color: c.acc }}>Lineup·Mate</p>
                <h1 className="text-4xl font-black" style={{ fontFamily: 'Syne, Nunito, sans-serif' }}>My Schedule</h1>
                <p className="mt-2 text-sm" style={{ color: c.muted }}>Your saved festivals and starred acts in one place.</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => router.push('/')} className="rounded-full px-4 py-2 text-sm font-black" style={{ background: c.surf2, border: `1px solid ${c.brd}`, color: c.txt }}>
                  Browse Events
                </button>
                {items.length > 0 && (
                  confirmClear ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold" style={{ color: c.muted }}>Remove acts?</span>
                      <button type="button" onClick={clearSchedule} className="rounded-full px-3 py-1.5 text-xs font-black text-white" style={{ background: '#dc2626' }}>Yes, clear all</button>
                      <button type="button" onClick={() => setConfirmClear(false)} className="rounded-full px-3 py-1.5 text-xs font-black" style={{ background: c.surf2, border: `1px solid ${c.brd}`, color: c.muted }}>Cancel</button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setConfirmClear(true)} className="rounded-full px-4 py-2 text-sm font-black" style={{ background: c.surf2, border: '1px solid #dc262640', color: '#dc2626' }}>
                      Clear All
                    </button>
                  )
                )}
              </div>
            </div>
          </header>

          {(!authReady || loading) && <p style={{ color: c.muted }}>Loading your schedule…</p>}
          {error && <p className="mb-4 rounded-xl p-4 text-sm text-red-700" style={{ background: '#fee2e2', border: '1px solid #fecaca' }}>{error}</p>}

          {authReady && !loading && !error && (
            <section className="mb-7 rounded-[28px] p-5 shadow-xl" style={{ background: c.surf, border: `1px solid ${c.brd}` }} data-testid="saved-festivals-section">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-widest" style={{ color: c.acc }}>Saved Festivals</p>
                  <h2 className="text-2xl font-black">Events you saved</h2>
                </div>
                <span className="rounded-full px-3 py-1 text-xs font-black" style={{ background: c.surf2, color: c.muted, border: `1px solid ${c.brd}` }}>
                  {savedFestivals.length} saved
                </span>
              </div>

              {savedFestivals.length === 0 ? (
                <div className="rounded-3xl p-5 text-center" style={{ background: c.surf2, border: `1px solid ${c.brd}` }}>
                  <div className="text-4xl">🎪</div>
                  <h3 className="mt-2 font-black">No saved festivals yet</h3>
                  <p className="mt-1 text-sm" style={{ color: c.muted }}>Save a festival from the home page and it will appear here.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="saved-festival-list">
                  {savedFestivals.map((festival) => (
                    <article key={festival.festivalId} className="overflow-hidden rounded-3xl" style={{ background: c.surf2, border: `1px solid ${c.brd}` }} data-testid="saved-festival-card">
                      <div className="h-2" style={{ background: festival.color }} />
                      <div className="p-4">
                        <div className="mb-3 flex items-start gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl" style={{ background: `${festival.color}22` }}>{festival.emoji}</div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-black uppercase" style={{ color: festival.color }}>{festival.genreLabel || 'Festival'}</p>
                            <h3 className="truncate text-xl font-black">{festivalTitle(festival.name, festival.year)}</h3>
                            <p className="mt-1 text-sm" style={{ color: c.muted }}>📍 {festival.location || 'Location TBA'}</p>
                            <p className="text-sm" style={{ color: c.muted }}>📅 {formatDateRange(festival.startDate, festival.endDate)}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => openFestival(festival.festivalId)} className="rounded-full px-4 py-2 text-sm font-black text-white" style={{ background: festival.color }}>
                            Open Festival
                          </button>
                          <button type="button" disabled={removingFestivalId === festival.festivalId} onClick={() => removeSavedFestival(festival)} className="rounded-full px-4 py-2 text-sm font-black disabled:opacity-60" style={{ background: c.surf, border: `1px solid ${c.brd}`, color: c.muted }}>
                            {removingFestivalId === festival.festivalId ? 'Removing…' : 'Remove'}
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {authReady && !loading && items.length === 0 && !error && (
            <div className="rounded-[28px] p-8 text-center" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
              <div className="text-5xl">☆</div>
              <h2 className="mt-3 text-2xl font-black">No saved acts yet</h2>
              <p className="mt-2 text-sm" style={{ color: c.muted }}>Open a festival and tap the star next to artists you do not want to miss.</p>
              <button type="button" onClick={() => router.push('/')} className="mt-5 rounded-full px-5 py-3 text-sm font-black text-white" style={{ background: `linear-gradient(135deg, ${c.acc}, ${c.accB})` }}>
                Find Festivals
              </button>
            </div>
          )}

          {authReady && items.length > 0 && (
            <div className="space-y-5" data-testid="saved-acts-section">
              {groupedItems.map((group) => (
                <section key={group.festivalId} className="overflow-hidden rounded-[28px] shadow-xl" style={{ background: c.surf, border: `1px solid ${c.brd}` }} data-testid="schedule-festival-group">
                  <div className="h-2" style={{ background: group.festivalColor }} />
                  <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl text-2xl" style={{ background: `${group.festivalColor}22` }}>{group.festivalEmoji}</div>
                      <div>
                        <h2 className="text-xl font-black">{group.festival}</h2>
                        <p className="text-sm" style={{ color: c.muted }}>{group.days.length} saved day{group.days.length === 1 ? '' : 's'}</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => openFestival(group.festivalId, group.days[0]?.dayDate)} className="rounded-full px-4 py-2 text-sm font-black text-white" style={{ background: group.festivalColor }}>
                      Open Festival
                    </button>
                  </div>

                  <div className="space-y-4 p-5 pt-0">
                    {group.days.map((dayGroup) => (
                      <section key={dayGroup.dayDate} className="rounded-3xl overflow-hidden" style={{ background: c.surf2, border: `1px solid ${c.brd}` }} data-testid="schedule-day-group">
                        <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between" style={{ borderBottom: `1px solid ${c.brd}` }}>
                          <div>
                            <h3 className="font-black">{dateLabel(dayGroup.dayDate)}</h3>
                            <p className="text-xs" style={{ color: c.muted }}>{dayGroup.items.length} saved act{dayGroup.items.length === 1 ? '' : 's'}</p>
                          </div>
                          <button type="button" data-testid="open-festival-day" onClick={() => openFestival(group.festivalId, dayGroup.dayDate)} className="rounded-full px-4 py-2 text-xs font-black text-white" style={{ background: group.festivalColor }}>
                            Open this day
                          </button>
                        </div>

                        <div className="divide-y" style={{ borderColor: c.brd }}>
                          {dayGroup.items.map((item) => (
                            <article key={item.performanceId} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex items-center gap-4">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl" style={{ background: `${item.stageColor}22`, color: item.stageColor }}>★</div>
                                <div>
                                  <h3 className="font-black">{item.artistName}</h3>
                                  <p className="text-sm" style={{ color: c.muted }}>{timeLabel(item.startTime)} – {timeLabel(item.endTime)} · <span style={{ color: item.stageColor }}>{item.stageName}</span></p>
                                </div>
                              </div>

                              <button type="button" disabled={removingId === item.performanceId} onClick={() => removeItem(item)} className="rounded-full px-4 py-2 text-sm font-black disabled:opacity-60" style={{ background: c.surf, border: `1px solid ${c.brd}`, color: c.muted }}>
                                {removingId === item.performanceId ? 'Removing…' : 'Remove'}
                              </button>
                            </article>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
