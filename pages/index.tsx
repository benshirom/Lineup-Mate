import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/lib/AuthContext';
import { formatDateRange, genreFilters, getThemeColors } from '@/lib/platform';

interface Festival {
  id: number;
  name: string;
  name_he?: string | null;
  year: number;
  location: string | null;
  location_he?: string | null;
  start_date: string | null;
  end_date: string | null;
  clashfinder_slug?: string | null;
  source_type?: string | null;
  last_synced_at?: string | null;
  emoji?: string | null;
  color?: string | null;
  genre?: string | null;
  genre_label?: string | null;
  description?: string | null;
  description_he?: string | null;
}

interface FestivalStats {
  festival_id: number;
  performances: number;
  stages: number;
  days: number;
}

export default function Home() {
  const { user, supabase, theme, t } = useAuth();
  const router = useRouter();
  const [festivals, setFestivals] = useState<Festival[]>([]);
  const [stats, setStats] = useState<Record<number, FestivalStats>>({});
  const [savedFestivalIds, setSavedFestivalIds] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState('all');

  const c = getThemeColors(theme);

  useEffect(() => {
    const fetchFestivals = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('festivals')
        .select('id, name, name_he, year, location, location_he, start_date, end_date, clashfinder_slug, source_type, last_synced_at, emoji, color, genre, genre_label, description, description_he')
        .order('start_date');

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      const festivalRows = data || [];
      setFestivals(festivalRows);

      if (festivalRows.length > 0) {
        const festivalIds = festivalRows.map((festival) => festival.id);
        const { data: performanceRows } = await supabase
          .from('performances')
          .select('festival_id, stage_id, day_date')
          .in('festival_id', festivalIds)
          .eq('is_active', true);

        const nextStats: Record<number, FestivalStats> = {};
        festivalRows.forEach((festival) => {
          const rows = (performanceRows || []).filter((row) => row.festival_id === festival.id);
          nextStats[festival.id] = {
            festival_id: festival.id,
            performances: rows.length,
            stages: new Set(rows.map((row) => row.stage_id)).size,
            days: new Set(rows.map((row) => row.day_date)).size
          };
        });
        setStats(nextStats);
      }

      setLoading(false);
    };

    fetchFestivals();
  }, [supabase]);

  useEffect(() => {
    const loadUserState = async () => {
      if (!user) {
        setIsAdmin(false);
        setSavedFestivalIds({});
        return;
      }

      const [{ data: profileData }, { data: savedRows }] = await Promise.all([
        supabase.from('profiles').select('role').eq('id', user.id).single(),
        supabase.from('saved_festivals').select('festival_id').eq('user_id', user.id)
      ]);

      setIsAdmin(profileData?.role === 'admin');
      setSavedFestivalIds(Object.fromEntries((savedRows || []).map((row) => [row.festival_id, true])));
    };

    loadUserState();
  }, [user, supabase]);

  const filteredFestivals = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return festivals.filter((festival) => {
      const title = `${festival.name} ${festival.name_he || ''} ${festival.location || ''} ${festival.location_he || ''}`.toLowerCase();
      const matchesQuery = !normalizedQuery || title.includes(normalizedQuery);
      const matchesGenre = genre === 'all' || festival.genre === genre;
      return matchesQuery && matchesGenre;
    });
  }, [festivals, query, genre]);

  const requireLogin = () => {
    if (!user) {
      router.push('/login');
      return false;
    }
    return true;
  };

  const toggleSavedFestival = async (festivalId: number) => {
    if (!requireLogin()) return;

    const isSaved = savedFestivalIds[festivalId];
    const previousSavedFestivalIds = savedFestivalIds;
    setSavedFestivalIds((current) => ({ ...current, [festivalId]: !isSaved }));

    const { error: saveError } = isSaved
      ? await supabase.from('saved_festivals').delete().eq('user_id', user!.id).eq('festival_id', festivalId)
      : await supabase
          .from('saved_festivals')
          .upsert({ user_id: user!.id, festival_id: festivalId }, { onConflict: 'user_id,festival_id' });

    if (saveError) {
      setSavedFestivalIds(previousSavedFestivalIds);
      setError(saveError.message);
      return;
    }

    const { data: savedRows } = await supabase
      .from('saved_festivals')
      .select('festival_id')
      .eq('user_id', user!.id);

    setSavedFestivalIds(Object.fromEntries((savedRows || []).map((row) => [row.festival_id, true])));
  };

  const getFestivalName = (festival: Festival) => festival.name;
  const getFestivalLocation = (festival: Festival) => festival.location;

  return (
    <>
      <Navbar />
      <main style={{ minHeight: '100vh', background: c.bg, color: c.txt }}>
        <section className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr] lg:items-center">
            <div className="fade-up">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold" style={{ background: `${c.acc}18`, color: c.acc, border: `1px solid ${c.acc}40` }}>
                <span className="inline-block h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: c.acc }} />
                {t.appName}
              </div>
              <h1 className="text-4xl font-black sm:text-6xl" style={{ fontFamily: 'Syne, Nunito, sans-serif', letterSpacing: '-0.03em', lineHeight: 1.05 }}>
                {t.heroTitle}
              </h1>
              <p className="mt-4 max-w-xl text-base sm:text-lg leading-relaxed" style={{ color: c.muted }}>
                {t.heroSub}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a href="#events" className="rounded-full px-6 py-3 text-sm font-black text-white shadow-lg transition hover:brightness-110 hover:-translate-y-0.5" style={{ background: `linear-gradient(135deg, ${c.acc}, ${c.accB})`, boxShadow: `0 4px 20px ${c.acc}55` }}>
                  {t.browseEvents}
                </a>
                {isAdmin && (
                  <button type="button" onClick={() => router.push('/admin')} className="rounded-full px-5 py-3 text-sm font-extrabold transition hover:brightness-105" style={{ background: c.surf, border: `1px solid ${c.brd}`, color: c.txt }}>
                    {t.importSync}
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-hidden rounded-[28px] p-5 shadow-2xl" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
              <div className="h-0.5 -mx-5 -mt-5 mb-5" style={{ background: `linear-gradient(90deg, ${c.acc}, ${c.accB})` }} />
              <div className="text-[10px] font-extrabold uppercase tracking-[0.15em]" style={{ color: c.muted }}>{t.upcomingEvents}</div>
              <div className="mt-3 space-y-2">
                {festivals.slice(0, 3).map((festival) => (
                  <button
                    key={festival.id}
                    type="button"
                    onClick={() => router.push(`/festival/${festival.id}`)}
                    className="flex w-full items-center gap-3 rounded-2xl p-3 text-left transition hover:brightness-105"
                    style={{ background: c.surf2 }}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg" style={{ background: `${festival.color || c.acc}22` }}>{festival.emoji || '🎪'}</div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-black" style={{ letterSpacing: '-0.01em' }}>{getFestivalName(festival)}</div>
                      <div className="truncate text-xs" style={{ color: c.muted }}>{getFestivalLocation(festival) || 'Location TBA'}</div>
                    </div>
                    <div className="h-2 w-2 shrink-0 rounded-full" style={{ background: festival.color || c.acc }} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="events" className="mx-auto max-w-6xl px-4 pb-14">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-2xl font-black" style={{ fontFamily: 'Syne, Nunito, sans-serif' }}>{t.upcomingEvents}</h2>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.searchEvents} className="w-full rounded-full px-4 py-3 text-sm outline-none sm:max-w-xs" style={{ background: c.surf, border: `1px solid ${c.brd}`, color: c.txt }} />
          </div>

          <div className="mb-6 flex flex-wrap gap-2">
            {genreFilters.map((filter) => (
              <button key={filter.key} type="button" onClick={() => setGenre(filter.key)} className="rounded-full px-4 py-2 text-xs font-extrabold transition" style={{ background: genre === filter.key ? c.acc : c.surf, color: genre === filter.key ? '#fff' : c.muted, border: `1px solid ${genre === filter.key ? c.acc : c.brd}` }}>
                {filter.label}
              </button>
            ))}
          </div>

          {loading && <p style={{ color: c.muted }}>Loading festivals…</p>}
          {error && <p className="rounded-xl p-4 text-sm text-red-700" style={{ background: '#fee2e2', border: '1px solid #fecaca' }}>{error}</p>}
          {!loading && !error && filteredFestivals.length === 0 && <p style={{ color: c.muted }}>No festivals available yet.</p>}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredFestivals.map((festival) => {
              const festivalStats = stats[festival.id] || { performances: 0, stages: 0, days: 0, festival_id: festival.id };
              const isSaved = savedFestivalIds[festival.id];
              return (
                <article key={festival.id} className="fade-up overflow-hidden rounded-[24px] shadow-xl transition hover:-translate-y-1 hover:shadow-2xl" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
                  <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${festival.color || c.acc}, ${c.accB})` }} />
                  <div className="p-5">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl shadow-sm" style={{ background: `linear-gradient(135deg, ${festival.color || c.acc}30, ${festival.color || c.acc}10)`, border: `1px solid ${festival.color || c.acc}33` }}>
                          {festival.emoji || '🎪'}
                        </div>
                        <div>
                          <h3 className="text-base font-black leading-snug" style={{ fontFamily: 'Syne, Nunito, sans-serif', letterSpacing: '-0.01em' }}>{getFestivalName(festival)}</h3>
                          <p className="text-[10px] font-extrabold uppercase tracking-[0.12em]" style={{ color: festival.color || c.acc }}>{festival.genre_label || festival.genre || 'Festival'}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleSavedFestival(festival.id)}
                        className="shrink-0 rounded-full px-2.5 py-1 text-xs font-extrabold transition"
                        style={{ background: isSaved ? `${c.acc}22` : c.surf2, color: isSaved ? c.acc : c.muted, border: `1px solid ${isSaved ? c.acc : c.brd}` }}
                      >
                        {isSaved ? '✓ Saved' : '+ Save'}
                      </button>
                    </div>

                    <div className="mb-4 space-y-1 text-xs" style={{ color: c.muted }}>
                      <div className="flex items-center gap-1.5"><span>📍</span><span className="truncate">{getFestivalLocation(festival) || 'Location TBA'}</span></div>
                      <div className="flex items-center gap-1.5"><span>📅</span><span>{formatDateRange(festival.start_date, festival.end_date)}</span></div>
                    </div>

                    <div className="mb-4 grid grid-cols-3 gap-1.5 text-center text-xs">
                      <div className="rounded-xl py-2" style={{ background: c.surf2 }}><b className="block text-base font-black" style={{ color: c.txt }}>{festivalStats.performances}</b><span style={{ color: c.muted }}>{t.artists}</span></div>
                      <div className="rounded-xl py-2" style={{ background: c.surf2 }}><b className="block text-base font-black" style={{ color: c.txt }}>{festivalStats.stages}</b><span style={{ color: c.muted }}>{t.stages}</span></div>
                      <div className="rounded-xl py-2" style={{ background: c.surf2 }}><b className="block text-base font-black" style={{ color: c.txt }}>{festivalStats.days}</b><span style={{ color: c.muted }}>{t.days}</span></div>
                    </div>

                    <button
                      type="button"
                      onClick={() => router.push(`/festival/${festival.id}`)}
                      className="w-full rounded-2xl px-4 py-3 text-sm font-black text-white transition hover:brightness-110"
                      style={{ background: `linear-gradient(135deg, ${festival.color || c.acc}, ${c.accB})`, boxShadow: `0 4px 16px ${festival.color || c.acc}44` }}
                    >
                      {t.viewLineup}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {!user && <p className="mt-6 text-center text-sm" style={{ color: c.muted }}>{t.signInToSave}</p>}
        </section>
      </main>
    </>
  );
}
