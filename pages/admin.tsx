import { FormEvent, useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/lib/AuthContext';

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
  imported?: number;
  skipped?: number;
  samplePerformances?: Array<{
    artistName: string;
    stageName: string;
    startTime: string;
    endTime: string;
    dayDate: string;
  }>;
  rawShape?: unknown;
}

export default function AdminPage() {
  const { user } = useAuth();
  const [slug, setSlug] = useState('ozora2026');
  const [secret, setSecret] = useState('');
  const [loadingAction, setLoadingAction] = useState<'preview' | 'import' | null>(null);
  const [result, setResult] = useState<AdminResponse | null>(null);

  useEffect(() => {
    const storedSecret = window.localStorage.getItem('lineup_mate_admin_secret');
    if (storedSecret) setSecret(storedSecret);
  }, []);

  const callAdminApi = async (endpoint: 'preview-clashfinder' | 'import-clashfinder') => {
    setResult(null);
    setLoadingAction(endpoint === 'preview-clashfinder' ? 'preview' : 'import');

    try {
      window.localStorage.setItem('lineup_mate_admin_secret', secret);

      const response = await fetch(`/api/admin/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': secret
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

  return (
    <>
      <Navbar />
      <main className="p-4 max-w-5xl mx-auto">
        <div className="mb-6">
          <p className="text-sm uppercase tracking-wide text-blue-600 font-semibold">Lineup-Mate Admin</p>
          <h1 className="text-3xl font-bold text-gray-900">Clashfinder Import & Sync</h1>
          <p className="mt-2 text-gray-600">
            Preview a Clashfinder response, verify the detected performances, then import or sync it into Supabase.
          </p>
        </div>

        <form onSubmit={handlePreview} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="slug">
              Clashfinder slug
            </label>
            <input
              id="slug"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              placeholder="Example: ozora2026"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Use the part from the URL, for example /s/ozora2026 or /m/ozora2026 → ozora2026.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="secret">
              Admin import secret
            </label>
            <input
              id="secret"
              type="password"
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              placeholder="ADMIN_IMPORT_SECRET from .env.local"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={!slug || !secret || loadingAction !== null}
              className="rounded-lg bg-gray-900 px-4 py-2 text-white hover:bg-black disabled:opacity-60"
            >
              {loadingAction === 'preview' ? 'Previewing…' : 'Preview'}
            </button>
            <button
              type="button"
              disabled={!slug || !secret || loadingAction !== null}
              onClick={handleImport}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loadingAction === 'import' ? 'Syncing…' : 'Import / Sync'}
            </button>
          </div>
        </form>

        {result && (
          <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
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

            <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              {typeof result.detectedPerformances === 'number' && (
                <div className="rounded-lg bg-gray-50 p-3"><strong>Detected:</strong> {result.detectedPerformances}</div>
              )}
              {typeof result.imported === 'number' && (
                <div className="rounded-lg bg-green-50 p-3"><strong>Imported/Synced:</strong> {result.imported}</div>
              )}
              {typeof result.skipped === 'number' && (
                <div className="rounded-lg bg-yellow-50 p-3"><strong>Skipped:</strong> {result.skipped}</div>
              )}
            </div>

            {result.samplePerformances && result.samplePerformances.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full text-sm">
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
                      <tr key={`${performance.artistName}-${performance.startTime}-${index}`} className="border-t border-gray-100">
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

            {result.rawShape && (
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
