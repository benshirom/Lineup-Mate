import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Navbar from '@/components/Navbar';
import Seo from '@/components/Seo';
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

const featureCards = [
  { eyebrow: 'Save', title: 'Pick your must-see sets', body: 'Build a personal lineup that stays easy to scan on the move.' },
  { eyebrow: 'Clash', title: 'Spot conflicts early', body: 'See overlaps before you are already walking to the wrong stage.' },
  { eyebrow: 'Crew', title: 'Plan the next move together', body: 'Create a group, share an invite code, and keep everyone aligned.' },
];

const nightPreview = [
  { time: '22:30', label: 'Main floor', title: 'Crew pick', state: 'Saved' },
  { time: '00:10', label: 'Forest stage', title: 'Schedule clash', state: 'Conflict' },
  { time: '01:45', label: 'Dome', title: 'Next move', state: 'Meet' },
];

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
  const [loginNudgeFestivalId, setLoginNudgeFestivalId] = useState<number | null>(null);

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

  const requireLogin = (festivalId?: number) => {
    if (!user) {
      setLoginNudgeFestivalId(festivalId ?? null);
      return false;
    }
    return true;
  };

  const toggleSavedFestival = async (festivalId: number) => {
    if (!requireLogin(festivalId)) return;

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
  const nudgeFestival = festivals.find((festival) => festival.id === loginNudgeFestivalId);

  return (
    <>
      <Seo />
      <Navbar />
      <main className="mobile-shell-padding" style={{ minHeight: '100vh', background: c.bg, color: c.txt }}>
        <section className="relative mx-auto max-w-6xl overflow-hidden px-4 py-10 sm:py-16">
          <div className="pointer-events-none absolute right-0 top-4 h-56 w-56 rounded-full blur-3xl" style={{ background: `${c.acc}22` }} />
          <div className="pointer-events-none absolute -left-10 top-24 h-48 w-48 rounded-full blur-3xl" style={{ background: `${c.accB}18` }} />

          <div className="relative grid gap-7 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
            <div className="fade-up">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold" style={{ background: `${c.accB}16`, color: c.accB, border: `1px solid ${c.accB}3d` }}>
                <span className="inline-block h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: c.accB }} />
                Built for festival crews
              </div>
              <h1 className="text-4xl font-black sm:text-6xl" style={{ fontFamily: 'Space Grotesk, Inter, sans-serif', letterSpacing: '-0.045em', lineHeight: 0.98 }}>
                {t.heroTitle}
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed sm:text-lg" style={{ color: c.muted }}>
                {t.heroSub}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a href="#events" className="tap-active rounded-full px-6 py-3 text-sm font-black text-white shadow-lg transition hover:brightness-110 hover:-translate-y-0.5" style={{ background: c.acc, boxShadow: `0 4px 20px ${c.acc}44` }}>
                  {t.browseEvents}
                </a>
                <a href="#how-it-works" className="tap-active rounded-full px-5 py-3 text-sm font-extrabold transition hover:brightness-105" style={{ background: c.surf, border: `1px solid ${c.brd}`, color: c.txt }}>
                  See how it works
                </a>
                {isAdmin && (
                  <button type="button" onClick={() => router.push('/admin')} className="tap-active rounded-full px-5 py-3 text-sm font-extrabold transition hover:brightness-105" style={{ background: c.surf, border: `1px solid ${c.brd}`, color: c.txt }}>
                    {t.importSync}
                  </button>
                )}
              </div>
              <div className="mt-6 grid max-w-xl grid-cols-3 gap-2 text-xs">
                {['Save artists', 'Avoid clashes', 'Sync your crew'].map((label) => (
                  <div key={label} className="rounded-2xl px-3 py-2 font-bold" style={{ background: `${c.surf2}cc`, border: `1px solid ${c.brd}`, color: c.muted }}>
                    {label}
                  </div>
                ))}
              </div>
            </div>

            <div data-testid="product-preview-card" className="fade-up overflow-hidden rounded-[30px] p-5 shadow-2xl" style={{ background: `linear-gradient(180deg, ${c.surf}, ${c.surf2})`, border: `1px solid ${c.brd}` }}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em]" style={{ color: c.muted }}>Your night</p>
                  <h2 className="mt-1 text-2xl font-black" style={{ fontFamily: 'Space Grotesk, Inter, sans-serif' }}>Crew radar</h2>
                </div>
                <span className="rounded-full px-3 py-1 text-xs font-black" style={{ background: `${c.success}1f`, color: c.success, border: `1px solid ${c.success}44` }}>Live plan</span>
              </div>
              <div className="space-y-3">
                {nightPreview.map((item, index) => (
                  <div key={item.time} className="relative overflow-hidden rounded-2xl p-4" style={{ background: c.surf, border: `1px solid ${index === 1 ? `${c.warning}55` : c.brd}` }}>
                    <div className="absolute left-0 top-0 h-full w-1" style={{ background: index === 1 ? c.warning : index === 2 ? c.accB : c.acc }} />
                    <div className="flex items-center justify-between gap-3 pl-2">
                      <div>
                        <div className="text-xs font-black" style={{ color: c.muted }}>{item.time} · {item.label}</div>
                        <div className="mt-1 text-base font-black">{item.title}</div>
                      </div>
                      <span className="rounded-full px-2.5 py-1 text-[10px] font-black" style={{ background: index === 1 ? `${c.warning}1f` : `${c.acc}18`, color: index === 1 ? c.warning : c.acc }}>
                        {item.state}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm leading-relaxed" style={{ color: c.muted }}>
                Clashfinder shows the schedule. Lineup·Mate helps you decide where to go next.
              </p>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="mx-auto max-w-6xl px-4 pb-12">
          <div className="mb-5 flex flex-col gap-2">
            <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: c.accB }}>How it works</p>
            <h2 className="text-3xl font-black" style={{ fontFamily: 'Space Grotesk, Inter, sans-serif' }}>From lineup overload to one clean plan.</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {featureCards.map((card, index) => (
              <article key={card.title} className="rounded-[24px] p-5" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
                <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full text-sm font-black" style={{ background: `${index === 1 ? c.warning : index === 2 ? c.accB : c.acc}1f`, color: index === 1 ? c.warning : index === 2 ? c.accB : c.acc }}>
                  {index + 1}
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: c.muted }}>{card.eyebrow}</p>
                <h3 className="mt-1 text-xl font-black">{card.title}</h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: c.muted }}>{card.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="events" className="mx-auto max-w-6xl px-4 pb-14">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: c.acc }}>{t.upcomingEvents}</p>
              <h2 className="mt-1 text-3xl font-black" style={{ fontFamily: 'Space Grotesk, Inter, sans-serif' }}>Choose your festival</h2>
            </div>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.searchEvents} className="w-full rounded-full px-4 py-3 text-sm outline-none sm:max-w-xs" style={{ background: c.surf, border: `1px solid ${c.brd}`, color: c.txt }} />
          </div>

          <div className="mb-6 flex gap-2 overflow-x-auto scroll-hidden pb-1" data-testid="genre-filter-row">
            {genreFilters.map((filter) => (
              <button key={filter.key} type="button" onClick={() => setGenre(filter.key)} className="shrink-0 rounded-full px-4 py-2 text-xs font-extrabold transition" style={{ background: genre === filter.key ? c.acc : c.surf, color: genre === filter.key ? '#fff' : c.muted, border: `1px solid ${genre === filter.key ? c.acc : c.brd}` }}>
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
                <article key={festival.id} data-testid="festival-card" className="fade-up overflow-hidden rounded-[24px] shadow-xl transition hover:-translate-y-1 hover:shadow-2xl" style={{ background: c.surf, border: `1px solid ${c.brd}`, borderTop: `2px solid ${festival.color || c.acc}` }}>
                  <div className="p-5">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-black shadow-sm" style={{ background: `${festival.color || c.acc}18`, border: `1px solid ${festival.color || c.acc}33`, color: festival.color || c.acc }}>
                          {(festival.name || 'F').slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="text-base font-black leading-snug" style={{ fontFamily: 'Space Grotesk, Inter, sans-serif', letterSpacing: '-0.01em' }}>{getFestivalName(festival)}</h3>
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
                      <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full" style={{ background: c.accB }} /><span className="truncate">{getFestivalLocation(festival) || 'Location TBA'}</span></div>
                      <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full" style={{ background: c.star }} /><span>{formatDateRange(festival.start_date, festival.end_date)}</span></div>
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
                      style={{ background: c.acc, boxShadow: `0 4px 16px ${c.acc}33` }}
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

        <section className="mx-auto max-w-6xl px-4 pb-16">
          <div className="rounded-[28px] p-5 sm:p-7" style={{ background: `linear-gradient(135deg, ${c.surf}, ${c.surf2})`, border: `1px solid ${c.brd}` }}>
            <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: c.accB }}>Crew mode</p>
            <h2 className="mt-2 text-3xl font-black" style={{ fontFamily: 'Space Grotesk, Inter, sans-serif' }}>The lineup is public. The plan is personal.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: c.muted }}>
              Lineup·Mate is designed for the moment when everyone wants to see something different. Save your picks, open a group, and use the schedule as a shared decision layer.
            </p>
          </div>
        </section>

        {loginNudgeFestivalId !== null && !user && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} onClick={() => setLoginNudgeFestivalId(null)}>
            <div className="w-full max-w-sm rounded-[28px] p-6 shadow-2xl" style={{ background: c.surf, border: `1px solid ${c.brd}` }} onClick={(event) => event.stopPropagation()}>
              <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: c.acc }}>Save your lineup</p>
              <h2 className="mt-2 text-2xl font-black">Create a free account first</h2>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: c.muted }}>
                Sign in to save {nudgeFestival ? getFestivalName(nudgeFestival) : 'this festival'}, mark your must-see artists, and plan with your crew.
              </p>
              <div className="mt-5 flex gap-2">
                <button type="button" onClick={() => setLoginNudgeFestivalId(null)} className="flex-1 rounded-2xl px-4 py-3 text-sm font-bold" style={{ background: c.surf2, border: `1px solid ${c.brd}`, color: c.muted }}>Maybe later</button>
                <button type="button" onClick={() => router.push('/login')} className="flex-1 rounded-2xl px-4 py-3 text-sm font-black text-white" style={{ background: c.acc }}>Continue</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
