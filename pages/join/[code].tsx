import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/lib/AuthContext';
import { getThemeColors } from '@/lib/platform';
import { sessionStore } from '@/lib/storage';

interface GroupPreview {
  festival_name: string;
  group_name: string;
  member_count: number;
}

export default function JoinPage() {
  const router = useRouter();
  const { code } = router.query;
  const { user, authReady, supabase: authSupabase, theme } = useAuth();
  const c = getThemeColors(theme);

  const [preview, setPreview] = useState<GroupPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  // Load group preview via rate-limited API route (avoids direct anonymous Supabase RPC call)
  useEffect(() => {
    if (!code || typeof code !== 'string') return;
    setLoading(true);
    setError(null);

    fetch(`/api/groups/preview?code=${encodeURIComponent(code)}`)
      .then(async (res) => {
        if (!res.ok) {
          setNotFound(true);
        } else {
          const data = await res.json();
          setPreview({
            festival_name: data.festival_name,
            group_name: data.group_name,
            member_count: Number(data.member_count),
          });
        }
        setLoading(false);
      })
      .catch(() => {
        setNotFound(true);
        setLoading(false);
      });
  }, [code]);

  // If user is authenticated, auto-join and redirect
  useEffect(() => {
    if (!authReady || !user || !code || typeof code !== 'string' || !preview) return;

    const autoJoin = async () => {
      setJoining(true);
      try {
        const { data: groupId, error: rpcError } = await authSupabase.rpc('join_group_by_invite_code', {
          p_invite_code: code.toLowerCase(),
        });
        if (rpcError) throw rpcError;
        router.replace(`/group/${groupId}?welcome=1`);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Could not join group.');
        setJoining(false);
      }
    };

    autoJoin();
  }, [authReady, user, code, preview, authSupabase, router]);

  const handleLoginRedirect = () => {
    if (typeof code === 'string') {
      sessionStore.set('pendingInviteCode', code);
    }
    router.push('/login');
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="mobile-shell-padding flex items-center justify-center" style={{ minHeight: '100dvh', background: c.bg, color: c.txt }}>
          <p style={{ color: c.muted }}>טוען…</p>
        </main>
      </>
    );
  }

  if (notFound) {
    return (
      <>
        <Navbar />
        <main className="mobile-shell-padding flex items-center justify-center p-4" style={{ minHeight: '100dvh', background: c.bg, color: c.txt }}>
          <div className="text-center max-w-sm">
            <div className="text-5xl mb-4">🔍</div>
            <h1 className="text-2xl font-black mb-2">קישור לא נמצא</h1>
            <p className="text-sm mb-6" style={{ color: c.muted }}>קישור ההזמנה הזה לא קיים או פג תוקפו.</p>
            <Link href="/" className="rounded-full px-6 py-3 text-sm font-bold text-white" style={{ background: c.acc }}>
              לדף הבית
            </Link>
          </div>
        </main>
      </>
    );
  }

  if (joining) {
    return (
      <>
        <Navbar />
        <main className="mobile-shell-padding flex items-center justify-center" style={{ minHeight: '100dvh', background: c.bg, color: c.txt }}>
          <p style={{ color: c.muted }}>מצטרף לקבוצה…</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="mobile-shell-padding flex items-center justify-center p-4" style={{ minHeight: '100dvh', background: c.bg, color: c.txt }}>
        <div className="w-full max-w-sm">
          {/* Preview card */}
          <div
            className="rounded-[28px] p-6 mb-5 shadow-xl fade-up"
            style={{ background: c.surf, border: `1px solid ${c.brd}` }}
          >
            <div className="text-center mb-4">
              <div className="text-5xl mb-2">🎪</div>
              <p className="text-xs font-extrabold uppercase tracking-widest mb-1" style={{ color: c.acc }}>
                {preview?.festival_name}
              </p>
              <h1 className="text-2xl font-black mb-1" data-testid="join-group-name">
                {preview?.group_name}
              </h1>
              <p className="text-sm" style={{ color: c.muted }}>
                {preview?.member_count} {preview?.member_count === 1 ? 'חבר' : 'חברים'} בקבוצה
              </p>
            </div>

            <div
              className="rounded-2xl p-3 text-sm text-center mb-4"
              style={{ background: c.surf2, border: `1px solid ${c.brd}`, color: c.muted }}
            >
              הצטרף לקבוצה וראה מה החברים שלך הולכים לראות בפסטיבל 🎵
            </div>

            {error && (
              <p className="mb-3 text-sm font-semibold text-center" style={{ color: c.danger }}>{error}</p>
            )}

            {!user && (
              <div className="space-y-2.5">
                <button
                  type="button"
                  data-testid="join-cta-login"
                  onClick={handleLoginRedirect}
                  className="w-full rounded-2xl py-3.5 text-sm font-bold text-white tap-active"
                  style={{ background: c.acc }}
                >
                  התחבר / הצטרף
                </button>
                <p className="text-center text-xs" style={{ color: c.muted }}>
                  אין לך חשבון?{' '}
                  <button
                    type="button"
                    onClick={handleLoginRedirect}
                    className="font-bold underline"
                    style={{ color: c.acc }}
                  >
                    הרשמה חינמית
                  </button>
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
