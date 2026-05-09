import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/lib/AuthContext';

interface Festival {
  id: number;
  name: string;
  year: number;
  location: string;
  start_date: string;
  end_date: string;
}

export default function Home() {
  const { user, supabase } = useAuth();
  const router = useRouter();
  const [festivals, setFestivals] = useState<Festival[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    const fetchFestivals = async () => {
      const { data, error } = await supabase
        .from('festivals')
        .select('*')
        .order('start_date');
      if (error) {
        console.error(error);
      } else {
        setFestivals(data || []);
      }
      setLoading(false);
    };
    fetchFestivals();
  }, [user, supabase, router]);

  return (
    <>
      <Navbar />
      <main className="p-4 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Select a Festival</h1>
        {loading && <p>Loading festivals…</p>}
        {!loading && festivals.length === 0 && <p>No festivals available.</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {festivals.map((festival) => (
            <div
              key={festival.id}
              className="border rounded-lg p-4 cursor-pointer hover:shadow-lg transition"
              onClick={() => router.push(`/festival/${festival.id}`)}
            >
              <h2 className="text-xl font-semibold">
                {festival.name} {festival.year}
              </h2>
              <p className="text-sm text-gray-600">{festival.location}</p>
              <p className="text-sm text-gray-600">
                {new Date(festival.start_date).toLocaleDateString()} –{' '}
                {new Date(festival.end_date).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}