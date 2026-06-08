import Head from 'next/head';

export default function OfflinePage() {
  return (
    <>
      <Head>
        <title>No connection — Lineup Mate</title>
      </Head>
      <div
        className="flex flex-col items-center justify-center text-center px-6"
        style={{ minHeight: '100dvh' }}
      >
        <div className="text-6xl mb-6">📡</div>
        <h1 className="text-2xl font-bold mb-3">No internet connection</h1>
        <p className="text-gray-400 mb-8 max-w-sm">
          Looks like you&apos;re offline. Check your connection and try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium transition-colors"
        >
          Try again
        </button>
      </div>
    </>
  );
}
