import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/lib/AuthContext';

interface Festival {
  id: number;
  name: string;
  year: number;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  clashfinder_slug?: string | null;
  source_type?: string | null;
  last_synced_at?: string | null;
}

export default function Home() {
  const { user, supabase } = useAuth();
  const router = useRouter();
  const [festivals, setFestivals] = useState<Festival[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const fetchFestivals = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('festivals')
        .select('id, name, year, location, start_date, end_date, clashfinder_slug, source_type, last_synced_at')
        .order('start_date');

      if (error) {
        setError(error.message);
      } else {
        setFestivals(data || []);
      }

      setLoading(false);
    };

    fetchFestivals();
  }, [supabase]);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        setIsAdmin(false);
        return;
      }

      const { data, error } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      setIsAdmin(!error && data?.role === 'admin');
    };

    checkAdmin();
  }, [user, supabase]);

  return (
    <>
      <Navbar />
      <main className="p-4 max-w-5xl mx-auto">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-wide text-blue-600 font-semibold">Lineup-Mate</p>
            <h1 className="text-3xl font-bold text-gray-900">Select a Festival</h1>
            <p className="mt-1 text-gray-600">Browse festivals and build your own lineup after signing in.</p>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => router.push('/admin')}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Import / Sync
            </button>
          )}
        </div>

        {loading && <p>Loading festivals…</p>}
        {error && <p className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 p-3">{error}</p>}
        {!loading && !error && festivals.length === 0 && <p>No festivals available yet.</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {festivals.map((festival) => (
            <button
              type="button"
              key={festival.id}
              className="text-left border border-gray-200 rounded-xl bg-white p-4 cursor-pointer hover:shadow-lg transition"
              onClick={() => router.push(`/festival/${festival.id}`)}
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-xl font-semibold text-gray-900">
                  {festival.name} {festival.year}
                </h2>
                <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700">
                  {festival.source_type || 'manual'}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-1">{festival.location || 'Location not set'}</p>
              <p className="text-sm text-gray-600 mt-1">
                {festival.start_date ? new Date(festival.start_date).toLocaleDateString() : '—'} –{' '}
                {festival.end_date ? new Date(festival.end_date).toLocaleDateString() : '—'}
              </p>
              {festival.clashfinder_slug && (
                <p className="text-xs text-gray-500 mt-3">Clashfinder: {festival.clashfinder_slug}</p>
              )}
              {festival.last_synced_at && (
                <p className="text-xs text-gray-500 mt-1">
                  Last sync: {new Date(festival.last_synced_at).toLocaleString()}
                </p>
              )}
            </button>
          ))}
        </div>
      </main>
    </>
  );
}
