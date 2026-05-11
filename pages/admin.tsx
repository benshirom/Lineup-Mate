import { FormEvent, useEffect, useMemo, useState } from 'react';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/lib/AuthContext';

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
  sampleStages?: string[];
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

export default function AdminPage() {
  const { user, session, supabase } = useAuth();
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
      const params = new URLSearchParams({
        scope: eventsScope,
        limit: '500'
      });
      if (eventsSearch.trim()) params.set('search', eventsSearch.trim());

      const response = await fetch(`/api/admin/clashfinder-events?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
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
        <main className="p-4 max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold mb-4">Admin</h1>
          <p>You must be signed in to use the admin tools.</p>
        </main>
      </>
    );
  }

  if (checkingRole) {
    return (
      <>
        <Navbar />
        <main className="p-4 max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold mb-4">Admin</h1>
          <p>Checking permissions…</p>
        </main>
      </>
    );
  }

  if (!isAdmin) {
    return (
      <>
        <Navbar />
        <main className="p-4 max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold mb-4">Admin</h1>
          <p className="rounded-lg bg-red-50 border border-red-200 text-red-700 p-3">
            You do not have permission to access the admin tools.
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="p-4 max-w-6xl mx-auto">
        <div className="mb-6">
          <p className="text-sm uppercase tracking-wide text-blue-600 font-semibold">Lineup-Mate Admin</p>
          <h1 className="text-3xl font-bold text-gray-900">Clashfinder Import & Sync</h1>
          <p className="mt-2 text-gray-600">
            Browse Clashfinder events, select one, preview the detected performances, then import or sync it into Supabase.
          </p>
        </div>

        <section className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="events-search">
                Search Clashfinder events
              </label>
              <input
                id="events-search"
                data-testid="clashfinder-events-search"
                value={eventsSearch}
                onChange={(event) => setEventsSearch(event.target.value)}
                placeholder="Example: Ozora, Boom, Glastonbury..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="events-scope">
                List type
              </label>
              <select
                id="events-scope"
                data-testid="clashfinder-events-scope"
                value={eventsScope}
                onChange={(event) => setEventsScope(event.target.value as 'core' | 'all')}
                className="rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loadingAction === 'events' ? 'Loading events…' : 'Load Events'}
            </button>
          </div>

          {eventsError && <p className="rounded-lg bg-red-50 border border-red-200 text-red-700 p-3">{eventsError}</p>}

          {events.length > 0 && (
            <div data-testid="clashfinder-events-results">
              <div className="mb-2 flex items-center justify-between text-sm text-gray-600">
                <span>Showing {events.length} events{eventsCount !== null ? ` out of ${eventsCount}` : ''}</span>
                {selectedEvent && <span data-testid="selected-clashfinder-event">Selected: <strong>{selectedEvent.name}</strong></span>}
              </div>
              <div className="max-h-80 overflow-auto rounded-lg border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2">Name</th>
                      <th className="text-left px-3 py-2">Slug / ID</th>
                      <th className="text-left px-3 py-2">Year</th>
                      <th className="text-left px-3 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((event) => (
                      <tr key={event.slug} data-testid="clashfinder-event-row" className={`border-t border-gray-100 ${event.slug === slug ? 'bg-blue-50' : ''}`}>
                        <td className="px-3 py-2 font-medium">{event.name}</td>
                        <td className="px-3 py-2"><code>{event.slug}</code></td>
                        <td className="px-3 py-2">{event.year || '—'}</td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            data-testid={`select-clashfinder-event-${event.slug}`}
                            onClick={() => selectEvent(event)}
                            className="rounded-lg bg-gray-900 px-3 py-1 text-white hover:bg-black"
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

        <form onSubmit={handlePreview} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="slug">
              Clashfinder slug / ID
            </label>
            <input
              id="slug"
              data-testid="clashfinder-slug-input"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              placeholder="Example: ozora2026"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Select from the event list above or use the part from the URL, for example /s/ozora2026 or /m/ozora2026 → ozora2026.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              data-testid="preview-clashfinder"
              disabled={!slug || loadingAction !== null}
              className="rounded-lg bg-gray-900 px-4 py-2 text-white hover:bg-black disabled:opacity-60"
            >
              {loadingAction === 'preview' ? 'Previewing…' : 'Preview'}
            </button>
            <button
              type="button"
              data-testid="import-clashfinder"
              disabled={!slug || loadingAction !== null}
              onClick={handleImport}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loadingAction === 'import' ? 'Syncing…' : 'Import / Sync'}
            </button>
          </div>
        </form>

        {result && (
          <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm" data-testid="clashfinder-preview-result">
            <h2 className="text-xl font-semibold mb-3">Result</h2>

            {result.error && <p className="rounded-lg bg-red-50 border border-red-200 text-red-700 p-3 mb-4">{result.error}</p>}
            {result.warning && <p className="rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-700 p-3 mb-4">{result.warning}</p>}

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

            <div className="mb-4 grid grid-cols-1 md:grid-cols-5 gap-3 text-sm">
              {typeof result.detectedPerformances === 'number' && (
                <div className="rounded-lg bg-gray-50 p-3"><strong>Detected:</strong> {result.detectedPerformances}</div>
              )}
              {typeof result.detectedStages === 'number' && (
                <div className="rounded-lg bg-blue-50 p-3" data-testid="detected-stages"><strong>Stages:</strong> {result.detectedStages}</div>
              )}
              {typeof result.imported === 'number' && (
                <div className="rounded-lg bg-green-50 p-3"><strong>Imported/Synced:</strong> {result.imported}</div>
              )}
              {typeof result.skipped === 'number' && (
                <div className="rounded-lg bg-yellow-50 p-3"><strong>Skipped:</strong> {result.skipped}</div>
              )}
              {typeof result.deactivated === 'number' && (
                <div className="rounded-lg bg-red-50 p-3"><strong>Deactivated:</strong> {result.deactivated}</div>
              )}
            </div>

            {result.sampleStages && result.sampleStages.length > 0 && (
              <div className="mb-4 rounded-lg bg-gray-50 p-3 text-sm" data-testid="sample-stages">
                <strong>Sample stages:</strong> {result.sampleStages.join(', ')}
              </div>
            )}

            {result.samplePerformances && result.samplePerformances.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full text-sm" data-testid="sample-performances-table">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2">Artist</th>
                      <th className="text-left px-3 py-2">Stage</th>
                      <th className="text-left px-3 py-2">Start</th>
                      <th className="text-left px-3 py-2">End</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.samplePerformances.map((performance, index) => (
                      <tr key={`${performance.artistName}-${performance.startTime}-${index}`} className="border-t border-gray-100" data-testid="sample-performance-row">
                        <td className="px-3 py-2">{performance.artistName}</td>
                        <td className="px-3 py-2">{performance.stageName}</td>
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
                <summary className="cursor-pointer text-sm font-medium text-gray-700">Raw response shape</summary>
                <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-gray-900 p-3 text-xs text-white">
                  {JSON.stringify(result.rawShape, null, 2)}
                </pre>
              </details>
            )}
          </section>
        )}
      </main>
    </>
  );
}
