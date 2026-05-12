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
  const { user, supabase, language, theme, t } = useAuth();
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
    setSavedFestivalIds((current) => ({ ...current, [festivalId]: !isSaved }));

    if (isSaved) {
      await supabase.from('saved_festivals').delete().eq('user_id', user!.id).eq('festival_id', festivalId);
    } else {
      await supabase.from('saved_festivals').insert({ user_id: user!.id, festival_id: festivalId });
    }
  };

  const getFestivalName = (festival: Festival) => language === 'he' && festival.name_he ? festival.name_he : festival.name;
  const getFestivalLocation = (festival: Festival) => language === 'he' && festival.location_he ? festival.location_he : festival.location;
  const getFestivalDescription = (festival: Festival) => language === 'he' && festival.description_he ? festival.description_he : festival.description;

  return (
    <>
      <Navbar />
      <main style={{ minHeight: '100vh', background: c.bg, color: c.txt }}>
        <section className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr] lg:items-center">
            <div>
              <div className="mb-4 inline-flex rounded-full px-3 py-1 text-xs font-bold" style={{ background: `${c.acc}20`, color: c.acc, border: `1px solid ${c.acc}55` }}>
                {t.appName} · v2
              </div>
              <h1 className="text-4xl font-black tracking-tight sm:text-6xl" style={{ fontFamily: 'Syne, Nunito, sans-serif' }}>
                {t.heroTitle}
              </h1>
              <p className="mt-4 max-w-2xl text-base sm:text-lg" style={{ color: c.muted }}>
                {t.heroSub}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a href="#events" className="rounded-full px-5 py-3 text-sm font-extrabold text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${c.acc}, ${c.accB})` }}>
                  {t.browseEvents}
                </a>
                {isAdmin && (
                  <button type="button" onClick={() => router.push('/admin')} className="rounded-full px-5 py-3 text-sm font-extrabold" style={{ background: c.surf, border: `1px solid ${c.brd}`, color: c.txt }}>
                    {t.importSync}
                  </button>
                )}
              </div>
            </div>

            <div className="rounded-[28px] p-5 shadow-2xl" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
              <div className="text-sm font-extrabold" style={{ color: c.muted }}>{t.upcomingEvents}</div>
              <div className="mt-4 space-y-3">
                {festivals.slice(0, 3).map((festival) => (
                  <div key={festival.id} className="flex items-center gap-3 rounded-2xl p-3" style={{ background: c.surf2 }}>
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl text-xl" style={{ background: `${festival.color || c.acc}22` }}>{festival.emoji || '🎪'}</div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-extrabold">{getFestivalName(festival)}</div>
                      <div className="truncate text-xs" style={{ color: c.muted }}>{getFestivalLocation(festival) || 'Location TBA'}</div>
                    </div>
                    <div className="h-3 w-3 rounded-full" style={{ background: festival.color || c.acc }} />
                  </div>
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
                {language === 'he' ? filter.he : filter.en}
              </button>
            ))}
          </div>

          {loading && <p style={{ color: c.muted }}>Loading festivals…</p>}
          {error && <p className="rounded-xl p-4 text-sm text-red-700" style={{ background: '#fee2e2', border: '1px solid #fecaca' }}>{error}</p>}
          {!loading && !error && filteredFestivals.length === 0 && <p style={{ color: c.muted }}>No festivals available yet.</p>}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredFestivals.map((festival) => {
              const festivalStats = stats[festival.id] || { performances: 0, stages: 0, days: 0, festival_id: festival.id };
              const isSaved = savedFestivalIds[festival.id];
              return (
                <article key={festival.id} className="overflow-hidden rounded-[24px] shadow-xl transition hover:-translate-y-1 hover:shadow-2xl" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
                  <div className="h-2" style={{ background: festival.color || c.acc }} />
                  <div className="p-5">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl text-3xl" style={{ background: `${festival.color || c.acc}22` }}>{festival.emoji || '🎪'}</div>
                        <div>
                          <h3 className="text-lg font-black leading-tight" style={{ fontFamily: 'Syne, Nunito, sans-serif' }}>{getFestivalName(festival)}</h3>
                          <p className="mt-1 text-xs font-bold" style={{ color: festival.color || c.acc }}>{festival.genre_label || festival.genre || 'Festival'}</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => toggleSavedFestival(festival.id)} className="rounded-full px-3 py-1 text-xs font-extrabold" style={{ background: isSaved ? `${c.acc}22` : c.surf2, color: isSaved ? c.acc : c.muted, border: `1px solid ${isSaved ? c.acc : c.brd}` }}>
                        {isSaved ? `✓ ${t.saved}` : t.saveFestival}
                      </button>
                    </div>

                    <p className="mb-3 line-clamp-2 text-sm leading-6" style={{ color: c.muted }}>
                      {getFestivalDescription(festival) || 'Discover the lineup, save artists and plan with friends.'}
                    </p>
                    <div className="space-y-1 text-sm" style={{ color: c.muted }}>
                      <div>📍 {getFestivalLocation(festival) || 'Location TBA'}</div>
                      <div>📅 {formatDateRange(festival.start_date, festival.end_date)}</div>
                    </div>

                    <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-2xl p-3" style={{ background: c.surf2 }}><b className="block text-lg" style={{ color: c.txt }}>{festivalStats.performances}</b>{t.artists}</div>
                      <div className="rounded-2xl p-3" style={{ background: c.surf2 }}><b className="block text-lg" style={{ color: c.txt }}>{festivalStats.stages}</b>{t.stages}</div>
                      <div className="rounded-2xl p-3" style={{ background: c.surf2 }}><b className="block text-lg" style={{ color: c.txt }}>{festivalStats.days}</b>{t.days}</div>
                    </div>

                    <button type="button" onClick={() => router.push(`/festival/${festival.id}`)} className="mt-5 w-full rounded-2xl px-4 py-3 text-sm font-black text-white" style={{ background: `linear-gradient(135deg, ${festival.color || c.acc}, ${c.accB})` }}>
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
