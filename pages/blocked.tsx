import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
import { getThemeColors } from '@/lib/platform';
import Navbar from '@/components/Navbar';

const BlockedPage = () => {
  const { theme } = useAuth();
  const router = useRouter();
  const c = getThemeColors(theme);

  return (
    <>
      <Navbar />
      <main
        style={{ minHeight: '100dvh', background: c.bg, color: c.txt }}
        className="flex flex-col items-center justify-center p-4"
      >
        <div
          className="w-full max-w-md rounded-[28px] p-8 shadow-2xl text-center"
          style={{ background: c.surf, border: `1px solid ${c.brd}` }}
        >
          <div className="mb-4 text-5xl">🚫</div>
          <div className="mb-2 text-xs font-extrabold uppercase tracking-widest" style={{ color: c.acc }}>
            Lineup·Mate
          </div>
          <h1 className="mb-3 text-2xl font-black" style={{ color: c.txt }}>
            Account Suspended
          </h1>
          <p className="mb-2 text-sm" style={{ color: c.muted }}>
            Your account has been suspended by an administrator. If you believe this is a mistake, please reach out:
          </p>
          <a
            href="mailto:support@lineup-mate.com"
            className="mb-6 inline-block text-sm font-bold"
            style={{ color: c.acc }}
          >
            support@lineup-mate.com
          </a>
          <button
            onClick={() => router.push('/')}
            className="w-full rounded-2xl px-4 py-3 text-sm font-black text-white"
            style={{ background: c.accHover }}
          >
            Back to Home
          </button>
        </div>
      </main>
    </>
  );
};

export default BlockedPage;
