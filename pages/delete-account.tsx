import { FormEvent, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/lib/AuthContext';
import { getThemeColors } from '@/lib/platform';

export default function DeleteAccountPage() {
  const router = useRouter();
  const { user, session, supabase, theme } = useAuth();
  const c = getThemeColors(theme);

  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canConfirm = confirmText.toLowerCase() === 'delete';

  const handleDelete = async (e: FormEvent) => {
    e.preventDefault();
    if (!session || !canConfirm) return;
    setDeleting(true);
    setError(null);
    try {
      const fnUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/delete-account`;
      const res = await fetch(fnUrl, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error('Deletion failed');
      await supabase.auth.signOut();
      router.push('/');
    } catch {
      setError('Could not delete your account. Please try again or contact support.');
      setDeleting(false);
    }
  };

  return (
    <>
      <Head>
        <title>Delete Account — Lineup Mate</title>
      </Head>
      <Navbar />
      <main
        id="main-content"
        className="mobile-shell-padding mx-auto max-w-lg px-4 py-10"
        style={{ minHeight: '100dvh', background: c.bg, color: c.txt }}
      >
        <header className="mb-8">
          <h1 className="text-3xl font-black" style={{ fontFamily: 'Syne, Nunito, sans-serif' }}>Delete Account</h1>
          <p className="mt-2 text-sm" style={{ color: c.muted }}>
            Permanently remove your Lineup Mate account and all associated data.
          </p>
        </header>

        <div className="mb-6 rounded-2xl p-4 text-sm" style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#7f1d1d' }}>
          <strong>What will be deleted:</strong>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Your profile and display name</li>
            <li>Your festival schedule picks</li>
            <li>Your group memberships (groups you own will be deleted)</li>
            <li>Your push notification subscriptions</li>
          </ul>
          <p className="mt-3"><strong>This action is permanent and cannot be undone.</strong></p>
        </div>

        {!user ? (
          <div className="rounded-2xl p-5" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
            <p className="mb-4 text-sm" style={{ color: c.muted }}>You must be signed in to delete your account.</p>
            <Link
              href="/login"
              className="inline-block rounded-full px-5 py-3 text-sm font-black text-white"
              style={{ background: c.accHover }}
            >
              Sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleDelete} className="rounded-2xl p-5" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
            {error && (
              <p role="alert" className="mb-4 rounded-xl p-3 text-sm text-red-700" style={{ background: '#fee2e2', border: '1px solid #fecaca' }}>
                {error}
              </p>
            )}

            <p className="mb-1 text-sm" style={{ color: c.muted }}>
              Signed in as <strong style={{ color: c.txt }}>{user.email}</strong>
            </p>

            <div className="mt-4">
              <label htmlFor="confirm-input" className="mb-1 block text-sm font-black" style={{ color: c.txt }}>
                Type <strong>delete</strong> to confirm
              </label>
              <input
                id="confirm-input"
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="delete"
                className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
                style={{ background: c.surf2, border: `1px solid ${c.brd}`, color: c.txt }}
                autoComplete="off"
                aria-describedby="confirm-hint"
              />
              <p id="confirm-hint" className="mt-1 text-xs" style={{ color: c.muted }}>
                Type the word &quot;delete&quot; (without quotes) to enable the button below.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={!canConfirm || deleting}
                className="rounded-full px-5 py-3 text-sm font-black text-white disabled:opacity-40"
                style={{ background: '#dc2626' }}
              >
                {deleting ? 'Deleting…' : 'Permanently Delete My Account'}
              </button>
              <Link
                href="/profile"
                className="inline-flex items-center rounded-full px-5 py-3 text-sm font-black"
                style={{ background: c.surf2, border: `1px solid ${c.brd}`, color: c.txt }}
              >
                Cancel
              </Link>
            </div>
          </form>
        )}

        <p className="mt-6 text-xs" style={{ color: c.muted }}>
          Need help? Contact us at{' '}
          <a href="mailto:support@lineupmate.app" className="underline" style={{ color: c.acc }}>
            support@lineupmate.app
          </a>
        </p>
      </main>
    </>
  );
}
