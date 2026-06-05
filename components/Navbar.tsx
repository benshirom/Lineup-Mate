import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { useState } from 'react';
import type { CSSProperties } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { createDesignSystem } from '@/lib/designSystem';
import { NotificationBell } from '@/components/NotificationBell';

const Navbar: React.FC = () => {
  const { user, profile, supabase, theme, t } = useAuth();
  const ds = createDesignSystem(theme);
  const c = ds.colors;
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

  const navLinkStyle = (href: string): CSSProperties => ({
    color: isActive(href) ? c.text : c.muted,
    fontWeight: isActive(href) ? 700 : 500,
  });

  return (
    <nav
      className="glass-nav sticky top-0 z-40"
      style={{ background: `${c.surface}f0`, borderBottom: `1px solid ${c.border}`, color: c.text }}
    >
      <div className="hidden md:flex items-center justify-between gap-3 px-6 py-3.5">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-base font-extrabold tracking-tight" style={{ color: c.primary, fontFamily: ds.typography.heading }}>
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
            <Link href="/admin/dashboard" className="text-sm hover:opacity-80 transition-opacity" style={navLinkStyle('/admin/dashboard')}>
              Admin
            </Link>
          )}
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <NotificationBell />
              <Link
                href="/profile"
                data-testid="user-profile-link"
                className="inline-flex max-w-[180px] truncate rounded-full px-3 py-1.5 text-xs font-bold hover:opacity-80 transition-opacity"
                style={{ background: c.surfaceElevated, color: c.text, border: `1px solid ${c.border}` }}
                title={user.email ?? undefined}
                aria-label="Open profile"
              >
                {displayLabel}
              </Link>
              <button
                onClick={handleSignOut}
                className="rounded-full px-3 py-1.5 text-xs font-bold hover:opacity-80 transition-opacity"
                style={{ background: c.surfaceElevated, color: c.muted, border: `1px solid ${c.border}` }}
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-full px-5 py-2 text-sm font-bold text-white tap-active"
              style={{ background: c.primary }}
            >
              Login
            </Link>
          )}
        </div>
      </div>

      <div className="flex md:hidden items-center justify-between px-4 py-3">
        <Link href="/" onClick={close} className="text-sm font-extrabold tracking-tight" style={{ color: c.primary, fontFamily: ds.typography.heading }}>
          {t.appName}
        </Link>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          className="tap-active flex h-11 w-11 items-center justify-center rounded-full text-lg font-bold transition-all"
          style={{ background: c.surfaceElevated, color: c.text, border: `1px solid ${c.border}` }}
        >
          {menuOpen ? '×' : '☰'}
        </button>
      </div>

      {menuOpen && (
        <div
          className="md:hidden flex flex-col gap-1 border-t px-4 pb-4 pt-3"
          style={{ borderColor: c.border, background: c.surface }}
        >
          {user ? (
            <>
              <Link href="/my-schedule" onClick={close} className="rounded-2xl px-4 py-3 text-sm font-semibold hover:opacity-80" style={{ color: c.text }}>
                {t.navMySchedule}
              </Link>
              <Link href="/groups" onClick={close} className="rounded-2xl px-4 py-3 text-sm font-semibold hover:opacity-80" style={{ color: c.text }}>
                {t.navGroups}
              </Link>
              <Link href="/profile" onClick={close} className="rounded-2xl px-4 py-3 text-sm font-semibold hover:opacity-80" style={{ color: c.text }}>
                {t.navProfile}
              </Link>
              {isAdmin && (
                <Link href="/admin/dashboard" onClick={close} className="rounded-2xl px-4 py-3 text-sm font-semibold hover:opacity-80" style={{ color: c.muted }}>
                  Admin
                </Link>
              )}
              <div className="mt-2 flex items-center justify-between rounded-2xl px-4 py-3" style={{ background: c.surfaceElevated, border: `1px solid ${c.border}` }}>
                <span className="max-w-[180px] truncate text-sm font-bold" style={{ color: c.text }}>{displayLabel}</span>
                <button
                  onClick={handleSignOut}
                  className="rounded-full px-3 py-1.5 text-xs font-bold"
                  style={{ background: c.surfaceHover, color: c.muted, border: `1px solid ${c.border}` }}
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
              style={{ background: c.primary }}
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
