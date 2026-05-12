import Link from 'next/link';
import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getThemeColors } from '@/lib/platform';

const Navbar: React.FC = () => {
  const { user, profile, supabase } = useAuth();
  const c = getThemeColors('dark');

  const isAdmin = profile?.role === 'admin';
  const displayLabel = profile?.display_name || user?.email?.split('@')[0] || 'Account';

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <nav style={{ background: c.surf, borderBottom: `1px solid ${c.brd}`, color: c.txt }} className="flex items-center justify-between px-5 py-3">
      <div className="flex items-center gap-5">
        <Link href="/" className="text-sm font-black tracking-tight" style={{ color: c.acc }}>
          Lineup·Mate
        </Link>
        {user && (
          <>
            <Link href="/my-schedule" className="text-sm font-bold hover:opacity-80" style={{ color: c.muted }}>
              My Schedule
            </Link>
            <Link href="/groups" className="text-sm font-bold hover:opacity-80" style={{ color: c.muted }}>
              Groups
            </Link>
            <Link href="/profile" className="text-sm font-bold hover:opacity-80" style={{ color: c.muted }}>
              Profile
            </Link>
          </>
        )}
        {user && isAdmin && (
          <Link href="/admin" className="text-sm font-bold hover:opacity-80" style={{ color: c.muted }}>
            Admin
          </Link>
        )}
      </div>

      <div className="flex items-center gap-3">
        {user ? (
          <>
            <Link
              href="/profile"
              className="hidden sm:inline text-xs font-black px-3 py-1 rounded-full hover:opacity-80"
              style={{ background: c.surf2, color: c.txt, border: `1px solid ${c.brd}` }}
              title={user.email ?? undefined}
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
