import Link from 'next/link';
import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getThemeColors } from '@/lib/platform';

const Navbar: React.FC = () => {
  const { user, profile, supabase, theme, t } = useAuth();
  const c = getThemeColors(theme);

  const isAdmin = profile?.role === 'admin';
  const displayLabel = profile?.display_name || user?.email?.split('@')[0] || 'Account';

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <nav style={{ background: c.surf, borderBottom: `1px solid ${c.brd}`, color: c.txt }} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/" className="text-sm font-black tracking-tight" style={{ color: c.acc }}>
          {t.appName}
        </Link>
        {user && (
          <>
            <Link href="/my-schedule" className="text-sm font-bold hover:opacity-80" style={{ color: c.muted }}>
              {t.navMySchedule}
            </Link>
            <Link href="/groups" className="text-sm font-bold hover:opacity-80" style={{ color: c.muted }}>
              {t.navGroups}
            </Link>
          </>
        )}
        {user && isAdmin && (
          <Link href="/admin" className="text-sm font-bold hover:opacity-80" style={{ color: c.muted }}>
            Admin
          </Link>
        )}
      </div>

      <div className="flex items-center gap-2">
        {user ? (
          <>
            <Link
              href="/profile"
              data-testid="user-profile-link"
              className="inline-flex max-w-[120px] truncate rounded-full px-3 py-1 text-xs font-black hover:opacity-80 sm:max-w-[180px]"
              style={{ background: c.surf2, color: c.txt, border: `1px solid ${c.brd}` }}
              title={user.email ?? undefined}
              aria-label="Open profile"
            >
              {displayLabel}
            </Link>
            <button onClick={handleSignOut} className="rounded-full px-3 py-1 text-xs font-black hover:opacity-80" style={{ background: '#dc262620', color: '#dc2626', border: '1px solid #dc262640' }}>
              Sign out
            </button>
          </>
        ) : (
          <Link href="/login" className="rounded-full px-4 py-1.5 text-xs font-black text-white" style={{ background: `linear-gradient(135deg, ${c.acc}, ${c.accB})` }}>
            Login
          </Link>
        )}
      </div>
    </nav>
  );
};

export default Navbar;