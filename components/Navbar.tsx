import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getThemeColors } from '@/lib/platform';

const Navbar: React.FC = () => {
  const { user, profile, supabase, theme, t } = useAuth();
  const c = getThemeColors(theme);
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const isAdmin = profile?.role === 'admin';
  const displayLabel = profile?.display_name || user?.email?.split('@')[0] || 'Account';

  const handleSignOut = async () => {
    setMenuOpen(false);
    await supabase.auth.signOut();
  };

  const close = () => setMenuOpen(false);

  const isActive = (href: string) =>
    href === '/' ? router.pathname === '/' : router.pathname.startsWith(href);

  const navLinkStyle = (href: string): React.CSSProperties => ({
    color: isActive(href) ? c.txt : c.muted,
    fontWeight: isActive(href) ? 700 : 500,
  });

  return (
    <nav
      className="glass-nav sticky top-0 z-40"
      style={{ background: `${c.surf}f0`, borderBottom: `1px solid ${c.brd}`, color: c.txt }}
    >
      {/* ── Desktop ─────────────────────────────────────── */}
      <div className="hidden md:flex items-center justify-between gap-3 px-6 py-3.5">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-base font-extrabold tracking-tight" style={{ color: c.acc }}>
            {t.appName}
          </Link>
          {user && (
            <>
              <Link href="/my-schedule" className="text-sm hover:opacity-80 transition-opacity" style={navLinkStyle('/my-schedule')}>
                {t.navMySchedule}
              </Link>
              <Link href="/groups" className="text-sm hover:opacity-80 transition-opacity" style={navLinkStyle('/groups')}>
                {t.navGroups}
              </Link>
            </>
          )}
          {isAdmin && (
            <Link href="/admin" className="text-sm hover:opacity-80 transition-opacity" style={{ color: c.muted }}>
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
                className="inline-flex max-w-[180px] truncate rounded-full px-3 py-1.5 text-xs font-bold hover:opacity-80 transition-opacity"
                style={{ background: c.surf2, color: c.txt, border: `1px solid ${c.brd}` }}
                title={user.email ?? undefined}
                aria-label="Open profile"
              >
                {displayLabel}
              </Link>
              <button
                onClick={handleSignOut}
                className="rounded-full px-3 py-1.5 text-xs font-bold hover:opacity-80 transition-opacity"
                style={{ background: c.surf2, color: c.muted, border: `1px solid ${c.brd}` }}
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-full px-5 py-2 text-sm font-bold text-white tap-active"
              style={{ background: c.acc }}
            >
              Login
            </Link>
          )}
        </div>
      </div>

      {/* ── Mobile top bar ─────────────────────────────── */}
      <div className="flex md:hidden items-center justify-between px-4 py-3">
        <Link href="/" onClick={close} className="text-sm font-extrabold tracking-tight" style={{ color: c.acc }}>
          {t.appName}
        </Link>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          className="tap-active flex h-11 w-11 items-center justify-center rounded-full text-lg font-bold transition-all"
          style={{ background: c.surf2, color: c.txt, border: `1px solid ${c.brd}` }}
        >
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* ── Mobile drawer ──────────────────────────────── */}
      {menuOpen && (
        <div
          className="md:hidden flex flex-col gap-1 border-t px-4 pb-4 pt-3"
          style={{ borderColor: c.brd, background: c.surf }}
        >
          {user ? (
            <>
              <Link href="/my-schedule" onClick={close} className="rounded-2xl px-4 py-3 text-sm font-semibold hover:opacity-80" style={{ color: c.txt }}>
                ⭐ {t.navMySchedule}
              </Link>
              <Link href="/groups" onClick={close} className="rounded-2xl px-4 py-3 text-sm font-semibold hover:opacity-80" style={{ color: c.txt }}>
                👥 {t.navGroups}
              </Link>
              <Link href="/profile" onClick={close} className="rounded-2xl px-4 py-3 text-sm font-semibold hover:opacity-80" style={{ color: c.txt }}>
                👤 {t.navProfile}
              </Link>
              {isAdmin && (
                <Link href="/admin" onClick={close} className="rounded-2xl px-4 py-3 text-sm font-semibold hover:opacity-80" style={{ color: c.muted }}>
                  🛠 Admin
                </Link>
              )}
              <div className="mt-2 flex items-center justify-between rounded-2xl px-4 py-3" style={{ background: c.surf2, border: `1px solid ${c.brd}` }}>
                <span className="max-w-[180px] truncate text-sm font-bold" style={{ color: c.txt }}>{displayLabel}</span>
                <button
                  onClick={handleSignOut}
                  className="rounded-full px-3 py-1.5 text-xs font-bold"
                  style={{ background: c.surf3, color: c.muted, border: `1px solid ${c.brd}` }}
                >
                  Sign out
                </button>
              </div>
            </>
          ) : (
            <Link
              href="/login"
              onClick={close}
              className="rounded-2xl px-5 py-3.5 text-center text-sm font-bold text-white tap-active"
              style={{ background: c.acc }}
            >
              Login
            </Link>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
