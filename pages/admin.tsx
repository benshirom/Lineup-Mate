import { FormEvent, useEffect, useMemo, useState } from 'react';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/lib/AuthContext';
import { getThemeColors } from '@/lib/platform';

type RawShape =
  | {
      type: string;
      length?: number;
      sampleKeys?: string[];
      keys?: string[];
    }
  | null;

interface ClashfinderEventListItem {
  slug: string;
  name: string;
  year: number | null;
  url: string | null;
  isCore?: boolean | null;
}

interface ClashfinderEventsResponse {
  ok?: boolean;
  error?: string;
  scope?: 'core' | 'all';
  count?: number;
  events?: ClashfinderEventListItem[];
}

interface AdminResponse {
  ok?: boolean;
  error?: string;
  warning?: string | null;
  festival?: {
    id?: number;
    slug?: string;
    name: string;
    year: number;
    location?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  };
  detectedPerformances?: number;
  detectedStages?: number;
  detectedDays?: number;
  sampleStages?: string[];
  sampleDays?: string[];
  imported?: number;
  skipped?: number;
  deactivated?: number;
  samplePerformances?: Array<{
    artistName: string;
    stageName: string;
    startTime: string;
    endTime: string;
    dayDate: string;
  }>;
  rawShape?: RawShape;
}

function formatDay(day: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
}

export default function AdminPage() {
  const { user, session, supabase, theme } = useAuth();
  const c = getThemeColors(theme);
  const [slug, setSlug] = useState('ozora2026');
  const [loadingAction, setLoadingAction] = useState<'preview' | 'import' | 'events' | null>(null);
  const [result, setResult] = useState<AdminResponse | null>(null);
  const [checkingRole, setCheckingRole] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [eventsScope, setEventsScope] = useState<'core' | 'all'>('all');
  const [eventsSearch, setEventsSearch] = useState('');
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [events, setEvents] = useState<ClashfinderEventListItem[]>([]);
  const [eventsCount, setEventsCount] = useState<number | null>(null);

  useEffect(() => {
    const checkRole = async () => {
      if (!user) {
        setIsAdmin(false);
        setCheckingRole(false);
        return;
      }

      const { data, error } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      setIsAdmin(!error && data?.role === 'admin');
      setCheckingRole(false);
    };

    checkRole();
  }, [user, supabase]);

  const selectedEvent = useMemo(() => events.find((event) => event.slug === slug), [events, slug]);

  const inputStyle = { background: c.surfaceHover, border: `1px solid ${c.border}`, color: c.txt };
  const mutedStyle = { color: c.muted };

  const getToken = () => {
    const token = session?.access_token;
    if (!token) throw new Error('Missing auth session. Please sign in again.');
    return token;
  };

  const loadClashfinderEvents = async () => {
    setEventsError(null);
    setLoadingAction('events');

    try {
      const token = getToken();
      const params = new URLSearchParams({ scope: eventsScope, limit: '500' });
      if (eventsSearch.trim()) params.set('search', eventsSearch.trim());

      const response = await fetch(`/api/admin/clashfinder-events?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = (await response.json()) as ClashfinderEventsResponse;
      if (!response.ok || data.error) throw new Error(data.error || 'Could not load Clashfinder events.');

      setEvents(data.events || []);
      setEventsCount(data.count ?? data.events?.length ?? 0);
    } catch (error: unknown) {
      setEventsError(error instanceof Error ? error.message : 'Unknown events list error');
    } finally {
      setLoadingAction(null);
    }
  };

  const callAdminApi = async (endpoint: 'preview-clashfinder' | 'import-clashfinder') => {
    setResult(null);
    setLoadingAction(endpoint === 'preview-clashfinder' ? 'preview' : 'import');

    try {
      const token = getToken();
      const response = await fetch(`/api/admin/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ slug })
      });

      const data = (await response.json()) as AdminResponse;
      setResult(data);
    } catch (error: unknown) {
      setResult({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setLoadingAction(null);
    }
  };

  const handlePreview = async (event: FormEvent) => {
    event.preventDefault();
    await callAdminApi('preview-clashfinder');
  };

  const handleImport = async () => {
    await callAdminApi('import-clashfinder');
  };

  const selectEvent = (event: ClashfinderEventListItem) => {
    setSlug(event.slug);
    setResult(null);
  };

  const renderShellMessage = (title: string, body: React.ReactNode) => (
    <>
      <Navbar />
      <main className="mobile-shell-padding px-4 py-8" style={{ minHeight: '100vh', background: c.bg, color: c.txt }}>
        <section className="premium-card mx-auto max-w-3xl p-6">
          <div className="relative z-10">
            <p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: c.primary }}>Lineup·Mate Admin</p>
            <h1 className="app-title mt-2 text-4xl font-black">{title}</h1>
            <div className="mt-4 text-sm leading-6" style={mutedStyle}>{body}</div>
          </div>
        </section>
      </main>
    </>
  );

  if (!user) return renderShellMessage('Admin', 'You must be signed in to use the admin tools.');
  if (checkingRole) return renderShellMessage('Admin', 'Checking permissions…');
  if (!isAdmin) {
    return renderShellMessage(
      'Admin',
      <p data-testid="admin-permission-error" className="rounded-2xl p-4 font-bold" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.26)', color: c.danger }}>
        You do not have permission to access the admin tools.
      </p>
    );
  }

  return (
    <>
      <Navbar />
      <main className="mobile-shell-padding px-4 py-8 md:px-6" style={{ minHeight: '100vh', background: c.bg, color: c.txt }}>
        <div className="mx-auto max-w-6xl">
          <header className="premium-card mb-6 p-6">
            <div className="relative z-10">
              <p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: c.primary }}>Lineup·Mate Admin</p>
              <h1 className="app-title mt-2 text-4xl font-black leading-tight sm:text-5xl">Clashfinder Import & Sync</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6" style={mutedStyle}>
                Browse Clashfinder events, select one, preview all detected days and stages, then import or sync it into Supabase.
              </p>
            </div>
          </header>

          <section className="premium-card mb-6 p-5">
            <div className="relative z-10 space-y-4">
              <div className="grid gap-4 lg:grid-cols-[1fr_190px_auto] lg:items-end">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.14em]" style={{ color: c.muted }}>Search Clashfinder events</span>
                  <input id="events-search" data-testid="clashfinder-events-search" value={eventsSearch} onChange={(event) => setEventsSearch(event.target.value)} placeholder="Example: Ozora, Boom, Glastonbury..." className="mobile-action w-full rounded-2xl px-4 py-3 text-sm outline-none" style={inputStyle} />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.14em]" style={{ color: c.muted }}>List type</span>
                  <select id="events-scope" data-testid="clashfinder-events-scope" value={eventsScope} onChange={(event) => setEventsScope(event.target.value as 'core' | 'all')} className="mobile-action w-full rounded-2xl px-4 py-3 text-sm outline-none" style={inputStyle}>
                    <option value="all">All clashfinders</option>
                    <option value="core">Core clashfinders</option>
                  </select>
                </label>

                <button type="button" data-testid="load-clashfinder-events" disabled={loadingAction !== null} onClick={loadClashfinderEvents} className="mobile-action rounded-2xl px-5 py-3 text-sm font-black text-white shadow-lg disabled:opacity-60" style={{ background: `linear-gradient(135deg, ${c.primary}, ${c.secondary})`, boxShadow: c.glow }}>
                  {loadingAction === 'events' ? 'Loading events…' : 'Load Events'}
                </button>
              </div>

              {eventsError && <p data-testid="clashfinder-events-error" className="rounded-2xl p-4 text-sm font-bold" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.26)', color: c.danger }}>{eventsError}</p>}

              {events.length > 0 && (
                <div data-testid="clashfinder-events-results">
                  <div className="mb-3 flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between" style={mutedStyle}>
                    <span>Showing {events.length} events{eventsCount !== null ? ` out of ${eventsCount}` : ''}</span>
                    {selectedEvent && <span data-testid="selected-clashfinder-event">Selected: <strong style={{ color: c.txt }}>{selectedEvent.name}</strong></span>}
                  </div>
                  <div className="max-h-80 overflow-auto rounded-2xl scroll-thin" style={{ border: `1px solid ${c.border}` }}>
                    <table className="min-w-full text-sm">
                      <thead style={{ background: c.surfaceHover }}>
                        <tr>
                          <th className="px-3 py-3 text-left">Name</th>
                          <th className="px-3 py-3 text-left">Slug / ID</th>
                          <th className="px-3 py-3 text-left">Year</th>
                          <th className="px-3 py-3 text-left">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {events.map((event) => (
                          <tr key={event.slug} data-testid="clashfinder-event-row" style={{ borderTop: `1px solid ${c.border}`, background: event.slug === slug ? c.primarySoft : 'transparent' }}>
                            <td className="px-3 py-3 font-bold">{event.name}</td>
                            <td className="px-3 py-3"><code>{event.slug}</code></td>
                            <td className="px-3 py-3">{event.year || '—'}</td>
                            <td className="px-3 py-3"><button type="button" data-testid={`select-clashfinder-event-${event.slug}`} onClick={() => selectEvent(event)} className="rounded-full px-3 py-1.5 text-xs font-black text-white" style={{ background: c.secondary }}>Select</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </section>

          <form onSubmit={handlePreview} className="premium-card p-5">
            <div className="relative z-10 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.14em]" style={{ color: c.muted }}>Clashfinder slug / ID</span>
                <input id="slug" data-testid="clashfinder-slug-input" value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="Example: ozora2026" className="mobile-action w-full rounded-2xl px-4 py-3 text-sm outline-none" style={inputStyle} />
                <span className="mt-1.5 block text-xs leading-5" style={mutedStyle}>Use the part from the URL, for example /s/ozora2026 or /m/ozora2026 → ozora2026.</span>
              </label>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button type="submit" data-testid="preview-clashfinder" disabled={!slug || loadingAction !== null} className="mobile-action rounded-2xl px-5 py-3 text-sm font-black disabled:opacity-60" style={{ background: c.surfaceHover, border: `1px solid ${c.border}`, color: c.txt }}>
                  {loadingAction === 'preview' ? 'Previewing…' : 'Preview'}
                </button>
                <button type="button" data-testid="import-clashfinder" disabled={!slug || loadingAction !== null} onClick={handleImport} className="mobile-action rounded-2xl px-5 py-3 text-sm font-black text-white shadow-lg disabled:opacity-60" style={{ background: `linear-gradient(135deg, ${c.primary}, ${c.secondary})`, boxShadow: c.glow }}>
                  {loadingAction === 'import' ? 'Syncing…' : 'Import / Sync'}
                </button>
              </div>
            </div>
          </form>

          {result && (
            <section className="premium-card mt-6 p-5" data-testid="clashfinder-preview-result">
              <div className="relative z-10">
                <h2 className="app-title mb-4 text-2xl font-black">Result</h2>

                {result.error && <p data-testid="clashfinder-preview-error" className="mb-4 rounded-2xl p-4 text-sm font-bold" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.26)', color: c.danger }}>{result.error}</p>}
                {result.warning && <p data-testid="clashfinder-preview-warning" className="mb-4 rounded-2xl p-4 text-sm font-bold" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.26)', color: c.warning }}>{result.warning}</p>}

                {result.festival && (
                  <div className="mb-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                    <div><strong>Name:</strong> {result.festival.name}</div>
                    <div><strong>Year:</strong> {result.festival.year}</div>
                    <div><strong>Start:</strong> {result.festival.startDate || '—'}</div>
                    <div><strong>End:</strong> {result.festival.endDate || '—'}</div>
                    {result.festival.id && <div><strong>Festival ID:</strong> {result.festival.id}</div>}
                    {result.festival.slug && <div><strong>Slug:</strong> {result.festival.slug}</div>}
                  </div>
                )}

                <div className="mb-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-3 xl:grid-cols-6">
                  {typeof result.detectedPerformances === 'number' && <div className="rounded-2xl p-3" style={{ background: c.surfaceHover }}><strong>Detected:</strong> {result.detectedPerformances}</div>}
                  {typeof result.detectedStages === 'number' && <div className="rounded-2xl p-3" style={{ background: c.surfaceHover }} data-testid="detected-stages"><strong>Stages:</strong> {result.detectedStages}</div>}
                  {typeof result.detectedDays === 'number' && <div className="rounded-2xl p-3" style={{ background: c.surfaceHover }} data-testid="detected-days"><strong>Days:</strong> {result.detectedDays}</div>}
                  {typeof result.imported === 'number' && <div className="rounded-2xl p-3" style={{ background: c.surfaceHover }}><strong>Synced:</strong> {result.imported}</div>}
                  {typeof result.skipped === 'number' && <div className="rounded-2xl p-3" style={{ background: c.surfaceHover }}><strong>Skipped:</strong> {result.skipped}</div>}
                  {typeof result.deactivated === 'number' && <div className="rounded-2xl p-3" style={{ background: c.surfaceHover }}><strong>Deactivated:</strong> {result.deactivated}</div>}
                </div>

                {result.sampleStages && result.sampleStages.length > 0 && <div className="mb-4 rounded-2xl p-3 text-sm" style={{ background: c.surfaceHover }} data-testid="sample-stages"><strong>Sample stages:</strong> {result.sampleStages.join(', ')}</div>}
                {result.sampleDays && result.sampleDays.length > 0 && <div className="mb-4 rounded-2xl p-3 text-sm" style={{ background: c.surfaceHover }} data-testid="sample-days"><strong>Sample days:</strong> {result.sampleDays.map(formatDay).join(', ')}</div>}

                {result.samplePerformances && result.samplePerformances.length > 0 && (
                  <div className="overflow-x-auto rounded-2xl scroll-thin" style={{ border: `1px solid ${c.border}` }}>
                    <table className="min-w-full text-sm" data-testid="sample-performances-table">
                      <thead style={{ background: c.surfaceHover }}>
                        <tr><th className="px-3 py-3 text-left">Artist</th><th className="px-3 py-3 text-left">Stage</th><th className="px-3 py-3 text-left">Day</th><th className="px-3 py-3 text-left">Start</th><th className="px-3 py-3 text-left">End</th></tr>
                      </thead>
                      <tbody>
                        {result.samplePerformances.map((performance, index) => (
                          <tr key={`${performance.artistName}-${performance.startTime}-${index}`} style={{ borderTop: `1px solid ${c.border}` }} data-testid="sample-performance-row">
                            <td className="px-3 py-3">{performance.artistName}</td><td className="px-3 py-3">{performance.stageName}</td><td className="px-3 py-3">{formatDay(performance.dayDate)}</td><td className="px-3 py-3">{new Date(performance.startTime).toLocaleString()}</td><td className="px-3 py-3">{new Date(performance.endTime).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {!!result.rawShape && (
                  <details className="mt-4">
                    <summary className="cursor-pointer text-sm font-bold" style={mutedStyle}>Raw response shape</summary>
                    <pre className="mt-2 max-h-72 overflow-auto rounded-2xl p-3 text-xs scroll-thin" style={{ background: c.surfaceHover, color: c.txt }}>{JSON.stringify(result.rawShape, null, 2)}</pre>
                  </details>
                )}
              </div>
            </section>
          )}
        </div>
      </main>
    </>
  );
}
