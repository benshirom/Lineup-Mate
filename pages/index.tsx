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
      const title = `${festival.name} ${festival.name_he || ''} ${festival.location || ''} ${festival.location_he || ''} ${festival.genre_label || ''}`.toLowerCase();
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
  const featuredFestival = festivals[0];

  return (
    <>
      <Navbar />
      <main className="mobile-shell-padding" style={{ minHeight: '100vh', background: c.bg, color: c.txt }}>
        <section className="mx-auto max-w-7xl px-4 pb-8 pt-8 sm:pb-12 sm:pt-12 md:px-6">
          <div className="grid gap-6 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
            <div className="fade-up">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black" style={{ background: c.primarySoft, color: c.primary, border: `1px solid rgba(139,92,246,0.28)` }}>
                <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: c.secondary, boxShadow: `0 0 12px ${c.secondary}` }} />
                Premium festival planner
              </div>
              <h1 className="app-title max-w-3xl text-4xl font-black leading-[0.98] sm:text-6xl lg:text-7xl">
                {t.heroTitle}
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 sm:text-lg" style={{ color: c.textSecondary }}>
                {t.heroSub}
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                <a href="#events" className="mobile-action inline-flex items-center justify-center rounded-2xl px-6 py-3 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5" style={{ background: `linear-gradient(135deg, ${c.primary}, ${c.secondary})`, boxShadow: c.glow }}>
                  {t.browseEvents}
                </a>
                {isAdmin && (
                  <button type="button" onClick={() => router.push('/admin')} className="mobile-action rounded-2xl px-5 py-3 text-sm font-black transition" style={{ background: c.surfaceElevated, border: `1px solid ${c.border}`, color: c.txt }}>
                    {t.importSync}
                  </button>
                )}
              </div>

              <div className="mt-7 grid grid-cols-3 gap-2 text-center sm:max-w-md">
                <div className="rounded-2xl p-3" style={{ background: c.surface, border: `1px solid ${c.border}` }}><b className="block text-lg">{festivals.length}</b><span className="text-[11px] font-bold" style={{ color: c.muted }}>Festivals</span></div>
                <div className="rounded-2xl p-3" style={{ background: c.surface, border: `1px solid ${c.border}` }}><b className="block text-lg">Plan</b><span className="text-[11px] font-bold" style={{ color: c.muted }}>Personal</span></div>
                <div className="rounded-2xl p-3" style={{ background: c.surface, border: `1px solid ${c.border}` }}><b className="block text-lg">Sync</b><span className="text-[11px] font-bold" style={{ color: c.muted }}>Friends</span></div>
              </div>
            </div>

            <div className="premium-card p-4 sm:p-5" data-testid="product-preview-card">
              <div className="relative z-10">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: c.muted }}>Tonight preview</div>
                    <h2 className="app-title mt-1 text-2xl font-black">Your festival plan</h2>
                  </div>
                  <span className="rounded-full px-3 py-1 text-xs font-black" style={{ background: c.secondarySoft, color: c.secondary, border: `1px solid rgba(6,182,212,0.22)` }}>Live</span>
                </div>

                <div className="space-y-3">
                  {(featuredFestival ? festivals.slice(0, 3) : []).map((festival, index) => (
                    <button key={festival.id} type="button" onClick={() => router.push(`/festival/${festival.id}`)} className="flex w-full items-center gap-3 rounded-[20px] p-3 text-left transition hover:opacity-95" style={{ background: c.surfaceHover, border: `1px solid ${c.borderSoft}` }}>
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-black" style={{ background: c.primarySoft, color: c.primary }}>{String(index + 1).padStart(2, '0')}</div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-black">{getFestivalName(festival)}</div>
                        <div className="truncate text-xs" style={{ color: c.muted }}>{getFestivalLocation(festival) || 'Location TBA'}</div>
                      </div>
                      <div className="h-2 w-2 shrink-0 rounded-full" style={{ background: festival.color || c.secondary }} />
                    </button>
                  ))}
                  {!featuredFestival && <p className="rounded-2xl p-4 text-sm" style={{ background: c.surfaceHover, color: c.muted }}>Festivals will appear here after import.</p>}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="events" className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: c.primary }}>Discover</p>
              <h2 className="app-title mt-1 text-3xl font-black sm:text-4xl">{t.upcomingEvents}</h2>
            </div>
            <label className="relative block w-full lg:max-w-md">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm" style={{ color: c.muted }}>Search</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.searchEvents} className="mobile-action w-full rounded-2xl py-3 pl-[72px] pr-4 text-sm outline-none" style={{ background: c.surface, border: `1px solid ${c.border}`, color: c.txt }} />
            </label>
          </div>

          <div className="mb-6 flex gap-2 overflow-x-auto scroll-hidden pb-1" data-testid="genre-filter-row">
            {genreFilters.map((filter) => {
              const active = genre === filter.key;
              return (
                <button key={filter.key} type="button" onClick={() => setGenre(filter.key)} className="mobile-action shrink-0 rounded-full px-4 py-2 text-xs font-black transition" style={{ background: active ? c.primarySoft : c.surface, color: active ? c.primary : c.muted, border: `1px solid ${active ? 'rgba(139,92,246,0.30)' : c.border}` }}>
                  {filter.label}
                </button>
              );
            })}
          </div>

          {loading && <p style={{ color: c.muted }}>Loading festivals…</p>}
          {error && <p className="rounded-2xl p-4 text-sm font-bold" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.26)', color: c.danger }}>{error}</p>}
          {!loading && !error && filteredFestivals.length === 0 && <p style={{ color: c.muted }}>No festivals available yet.</p>}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredFestivals.map((festival) => {
              const festivalStats = stats[festival.id] || { performances: 0, stages: 0, days: 0, festival_id: festival.id };
              const isSaved = savedFestivalIds[festival.id];
              return (
                <article key={festival.id} className="premium-card fade-up p-4 transition hover:-translate-y-0.5" data-testid="festival-card">
                  <div className="relative z-10">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="mb-1 text-[10px] font-black uppercase tracking-[0.15em]" style={{ color: c.secondary }}>{festival.genre_label || festival.genre || 'Festival'}</p>
                        <h3 className="app-title truncate text-xl font-black leading-tight">{getFestivalName(festival)}</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleSavedFestival(festival.id)}
                        className="mobile-action shrink-0 rounded-full px-3 py-1.5 text-xs font-black transition"
                        style={{ background: isSaved ? 'rgba(250,204,21,0.14)' : c.surfaceHover, color: isSaved ? c.star : c.muted, border: `1px solid ${isSaved ? 'rgba(250,204,21,0.34)' : c.border}` }}
                        aria-label={isSaved ? 'Saved festival' : 'Save festival'}
                      >
                        {isSaved ? 'Saved' : 'Save'}
                      </button>
                    </div>

                    <div className="mb-4 space-y-2 text-sm" style={{ color: c.muted }}>
                      <div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full" style={{ background: festival.color || c.secondary }} /><span className="truncate">{getFestivalLocation(festival) || 'Location TBA'}</span></div>
                      <div>{formatDateRange(festival.start_date, festival.end_date)}</div>
                    </div>

                    <div className="mb-4 grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-2xl py-2" style={{ background: c.surfaceHover }}><b className="block text-base font-black" style={{ color: c.txt }}>{festivalStats.performances}</b><span style={{ color: c.muted }}>{t.artists}</span></div>
                      <div className="rounded-2xl py-2" style={{ background: c.surfaceHover }}><b className="block text-base font-black" style={{ color: c.txt }}>{festivalStats.stages}</b><span style={{ color: c.muted }}>{t.stages}</span></div>
                      <div className="rounded-2xl py-2" style={{ background: c.surfaceHover }}><b className="block text-base font-black" style={{ color: c.txt }}>{festivalStats.days}</b><span style={{ color: c.muted }}>{t.days}</span></div>
                    </div>

                    <button type="button" onClick={() => router.push(`/festival/${festival.id}`)} className="mobile-action w-full rounded-2xl px-4 py-3 text-sm font-black text-white transition hover:opacity-95" style={{ background: `linear-gradient(135deg, ${c.primary}, ${c.secondary})` }}>
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
