import Head from 'next/head';
import { useAuth } from '@/lib/AuthContext';
import { getThemeColors } from '@/lib/platform';

export default function OfflinePage() {
  const { theme } = useAuth();
  const c = getThemeColors(theme);

  return (
    <>
      <Head>
        <title>No connection — Lineup Mate</title>
      </Head>
      <div
        className="flex flex-col items-center justify-center text-center px-6"
        style={{ minHeight: '100dvh', background: c.bg, color: c.txt }}
      >
        <div className="text-6xl mb-6">📡</div>
        <h1 className="text-2xl font-bold mb-3">No internet connection</h1>
        <p className="mb-8 max-w-sm" style={{ color: c.muted }}>
          Looks like you&apos;re offline. Check your connection and try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 text-white rounded-xl font-medium transition-opacity hover:opacity-80"
          style={{ background: c.accHover }}
        >
          Try again
        </button>
      </div>
    </>
  );
}
