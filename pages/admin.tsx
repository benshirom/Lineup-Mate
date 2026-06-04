import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/lib/AuthContext';
import { getThemeColors } from '@/lib/platform';

const NAV_LINKS = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/groups', label: 'Groups' },
  { href: '/admin', label: 'Import' },
];

function AdminSubNav({ c }: { c: ReturnType<typeof getThemeColors> }) {
  const router = useRouter();
  return (
    <div style={{ background: c.surf, borderBottom: `1px solid ${c.brd}` }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px', display: 'flex', gap: 8, overflowX: 'auto' as const }}>
        {NAV_LINKS.map((link) => {
          const isActive = router.pathname === link.href;
          return (
            <Link key={link.href} href={link.href} style={{ display: 'inline-block', padding: '10px 16px', fontSize: 14, fontWeight: isActive ? 600 : 400, color: isActive ? '#fff' : c.txt, background: isActive ? c.acc : 'transparent', borderRadius: 0, borderBottom: isActive ? `2px solid ${c.acc}` : '2px solid transparent', textDecoration: 'none', whiteSpace: 'nowrap' as const }}>
              {link.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

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

  const inputStyle = { background: c.surf2, border: `1px solid ${c.brd}`, color: c.txt };
  const cardStyle = { background: c.surf, border: `1px solid ${c.brd}`, color: c.txt };
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

  if (!user) {
    return (
      <>
        <Navbar />
        <AdminSubNav c={c} />
        <main className="mobile-shell-padding p-4" style={{ minHeight: '100vh', background: c.bg, color: c.txt }}>
          <section className="max-w-3xl mx-auto rounded-2xl p-5" style={cardStyle}>
            <h1 className="text-3xl font-bold mb-4">Admin</h1>
            <p style={mutedStyle}>You must be signed in to use the admin tools.</p>
          </section>
        </main>
      </>
    );
  }

  if (checkingRole) {
    return (
      <>
        <Navbar />
        <AdminSubNav c={c} />
        <main className="mobile-shell-padding p-4" style={{ minHeight: '100vh', background: c.bg, color: c.txt }}>
          <section className="max-w-3xl mx-auto rounded-2xl p-5" style={cardStyle}>
            <h1 className="text-3xl font-bold mb-4">Admin</h1>
            <p style={mutedStyle}>Checking permissions…</p>
          </section>
        </main>
      </>
    );
  }

  if (!isAdmin) {
    return (
      <>
        <Navbar />
        <AdminSubNav c={c} />
        <main className="mobile-shell-padding p-4" style={{ minHeight: '100vh', background: c.bg, color: c.txt }}>
          <section className="max-w-3xl mx-auto rounded-2xl p-5" style={cardStyle}>
            <h1 className="text-3xl font-bold mb-4">Admin</h1>
            <p data-testid="admin-permission-error" className="rounded-lg bg-red-50 border border-red-200 text-red-700 p-3">
              You do not have permission to access the admin tools.
            </p>
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <AdminSubNav c={c} />
      <main className="mobile-shell-padding p-4" style={{ minHeight: '100vh', background: c.bg, color: c.txt }}>
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <p className="text-sm uppercase tracking-wide font-semibold" style={{ color: c.acc }}>Lineup-Mate Admin</p>
            <h1 className="text-3xl font-bold">Clashfinder Import & Sync</h1>
            <p className="mt-2" style={mutedStyle}>
              Browse Clashfinder events, select one, preview all detected days/stages, then import or sync it into Supabase.
            </p>
          </div>

          <section className="mb-6 rounded-xl p-5 shadow-sm space-y-4" style={cardStyle}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1" htmlFor="events-search">
                  Search Clashfinder events
                </label>
                <input
                  id="events-search"
                  data-testid="clashfinder-events-search"
                  value={eventsSearch}
                  onChange={(event) => setEventsSearch(event.target.value)}
                  placeholder="Example: Ozora, Boom, Glastonbury..."
                  className="w-full rounded-lg px-3 py-2 focus:outline-none focus:ring-2"
                  style={inputStyle}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="events-scope">
                  List type
                </label>
                <select
                  id="events-scope"
                  data-testid="clashfinder-events-scope"
                  value={eventsScope}
                  onChange={(event) => setEventsScope(event.target.value as 'core' | 'all')}
                  className="rounded-lg px-3 py-2 focus:outline-none focus:ring-2"
                  style={inputStyle}
                >
                  <option value="all">All clashfinders</option>
                  <option value="core">Core clashfinders</option>
                </select>
              </div>

              <button
                type="button"
                data-testid="load-clashfinder-events"
                disabled={loadingAction !== null}
                onClick={loadClashfinderEvents}
                className="rounded-lg px-4 py-2 text-white disabled:opacity-60"
                style={{ background: c.acc }}
              >
                {loadingAction === 'events' ? 'Loading events…' : 'Load Events'}
              </button>
            </div>

            {eventsError && <p data-testid="clashfinder-events-error" className="rounded-lg bg-red-50 border border-red-200 text-red-700 p-3">{eventsError}</p>}

            {events.length > 0 && (
              <div data-testid="clashfinder-events-results">
                <div className="mb-2 flex items-center justify-between text-sm" style={mutedStyle}>
                  <span>Showing {events.length} events{eventsCount !== null ? ` out of ${eventsCount}` : ''}</span>
                  {selectedEvent && <span data-testid="selected-clashfinder-event">Selected: <strong>{selectedEvent.name}</strong></span>}
                </div>
                <div className="max-h-80 overflow-auto rounded-lg" style={{ border: `1px solid ${c.brd}` }}>
                  <table className="min-w-full text-sm">
                    <thead style={{ background: c.surf2 }}>
                      <tr>
                        <th className="text-left px-3 py-2">Name</th>
                        <th className="text-left px-3 py-2">Slug / ID</th>
                        <th className="text-left px-3 py-2">Year</th>
                        <th className="text-left px-3 py-2">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((event) => (
                        <tr key={event.slug} data-testid="clashfinder-event-row" style={{ borderTop: `1px solid ${c.brd}`, background: event.slug === slug ? `${c.acc}22` : 'transparent' }}>
                          <td className="px-3 py-2 font-medium">{event.name}</td>
                          <td className="px-3 py-2"><code>{event.slug}</code></td>
                          <td className="px-3 py-2">{event.year || '—'}</td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              data-testid={`select-clashfinder-event-${event.slug}`}
                              onClick={() => selectEvent(event)}
                              className="rounded-lg px-3 py-1 text-white"
                              style={{ background: c.acc }}
                            >
                              Select
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          <form onSubmit={handlePreview} className="rounded-xl p-5 shadow-sm space-y-4" style={cardStyle}>
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="slug">
                Clashfinder slug / ID
              </label>
              <input
                id="slug"
                data-testid="clashfinder-slug-input"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                placeholder="Example: ozora2026"
                className="w-full rounded-lg px-3 py-2 focus:outline-none focus:ring-2"
                style={inputStyle}
              />
              <p className="text-xs mt-1" style={mutedStyle}>
                Select from the event list above or use the part from the URL, for example /s/ozora2026 or /m/ozora2026 → ozora2026.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                data-testid="preview-clashfinder"
                disabled={!slug || loadingAction !== null}
                className="rounded-lg px-4 py-2 text-white disabled:opacity-60"
                style={{ background: c.surf2, border: `1px solid ${c.brd}`, color: c.txt }}
              >
                {loadingAction === 'preview' ? 'Previewing…' : 'Preview'}
              </button>
              <button
                type="button"
                data-testid="import-clashfinder"
                disabled={!slug || loadingAction !== null}
                onClick={handleImport}
                className="rounded-lg px-4 py-2 text-white disabled:opacity-60"
                style={{ background: c.acc }}
              >
                {loadingAction === 'import' ? 'Syncing…' : 'Import / Sync'}
              </button>
            </div>
          </form>

          {result && (
            <section className="mt-6 rounded-xl p-5 shadow-sm" style={cardStyle} data-testid="clashfinder-preview-result">
              <h2 className="text-xl font-semibold mb-3">Result</h2>

              {result.error && <p data-testid="clashfinder-preview-error" className="rounded-lg bg-red-50 border border-red-200 text-red-700 p-3 mb-4">{result.error}</p>}
              {result.warning && <p data-testid="clashfinder-preview-warning" className="rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-700 p-3 mb-4">{result.warning}</p>}

              {result.festival && (
                <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div><strong>Name:</strong> {result.festival.name}</div>
                  <div><strong>Year:</strong> {result.festival.year}</div>
                  <div><strong>Start:</strong> {result.festival.startDate || '—'}</div>
                  <div><strong>End:</strong> {result.festival.endDate || '—'}</div>
                  {result.festival.id && <div><strong>Festival ID:</strong> {result.festival.id}</div>}
                  {result.festival.slug && <div><strong>Slug:</strong> {result.festival.slug}</div>}
                </div>
              )}

              <div className="mb-4 grid grid-cols-1 md:grid-cols-6 gap-3 text-sm">
                {typeof result.detectedPerformances === 'number' && <div className="rounded-lg p-3" style={{ background: c.surf2 }}><strong>Detected:</strong> {result.detectedPerformances}</div>}
                {typeof result.detectedStages === 'number' && <div className="rounded-lg p-3" style={{ background: c.surf2 }} data-testid="detected-stages"><strong>Stages:</strong> {result.detectedStages}</div>}
                {typeof result.detectedDays === 'number' && <div className="rounded-lg p-3" style={{ background: c.surf2 }} data-testid="detected-days"><strong>Days:</strong> {result.detectedDays}</div>}
                {typeof result.imported === 'number' && <div className="rounded-lg p-3" style={{ background: c.surf2 }}><strong>Imported/Synced:</strong> {result.imported}</div>}
                {typeof result.skipped === 'number' && <div className="rounded-lg p-3" style={{ background: c.surf2 }}><strong>Skipped:</strong> {result.skipped}</div>}
                {typeof result.deactivated === 'number' && <div className="rounded-lg p-3" style={{ background: c.surf2 }}><strong>Deactivated:</strong> {result.deactivated}</div>}
              </div>

              {result.sampleStages && result.sampleStages.length > 0 && (
                <div className="mb-4 rounded-lg p-3 text-sm" style={{ background: c.surf2 }} data-testid="sample-stages">
                  <strong>Sample stages:</strong> {result.sampleStages.join(', ')}
                </div>
              )}

              {result.sampleDays && result.sampleDays.length > 0 && (
                <div className="mb-4 rounded-lg p-3 text-sm" style={{ background: c.surf2 }} data-testid="sample-days">
                  <strong>Sample days:</strong> {result.sampleDays.map(formatDay).join(', ')}
                </div>
              )}

              {result.samplePerformances && result.samplePerformances.length > 0 && (
                <div className="overflow-x-auto rounded-lg" style={{ border: `1px solid ${c.brd}` }}>
                  <table className="min-w-full text-sm" data-testid="sample-performances-table">
                    <thead style={{ background: c.surf2 }}>
                      <tr>
                        <th className="text-left px-3 py-2">Artist</th>
                        <th className="text-left px-3 py-2">Stage</th>
                        <th className="text-left px-3 py-2">Day</th>
                        <th className="text-left px-3 py-2">Start</th>
                        <th className="text-left px-3 py-2">End</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.samplePerformances.map((performance, index) => (
                        <tr key={`${performance.artistName}-${performance.startTime}-${index}`} style={{ borderTop: `1px solid ${c.brd}` }} data-testid="sample-performance-row">
                          <td className="px-3 py-2">{performance.artistName}</td>
                          <td className="px-3 py-2">{performance.stageName}</td>
                          <td className="px-3 py-2">{formatDay(performance.dayDate)}</td>
                          <td className="px-3 py-2">{new Date(performance.startTime).toLocaleString()}</td>
                          <td className="px-3 py-2">{new Date(performance.endTime).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {!!result.rawShape && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-medium" style={mutedStyle}>Raw response shape</summary>
                  <pre className="mt-2 max-h-72 overflow-auto rounded-lg p-3 text-xs" style={{ background: c.surf2, color: c.txt }}>
                    {JSON.stringify(result.rawShape, null, 2)}
                  </pre>
                </details>
              )}
            </section>
          )}
        </div>
      </main>
    </>
  );
}
