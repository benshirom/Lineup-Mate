import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getThemeColors } from '@/lib/platform';

const navItems = [
  { href: '/', label: 'Festivals' },
  { href: '/my-schedule', label: 'My Schedule', authOnly: true },
  { href: '/groups', label: 'Groups', authOnly: true }
];

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
  const isActive = (href: string) => router.pathname === href || (href !== '/' && router.pathname.startsWith(href));

  return (
    <nav className="sticky top-0 z-40 border-b glass-nav" style={{ color: c.txt }}>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-6">
        <Link href="/" onClick={close} className="group flex items-center gap-2" aria-label="Lineup Mate home">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-2xl text-sm font-black text-white shadow-lg"
            style={{ background: `linear-gradient(135deg, ${c.primary}, ${c.secondary})`, boxShadow: c.glow }}
          >
            LM
          </span>
          <span className="app-title text-base font-black tracking-tight" style={{ color: c.txt }}>
            {t.appName}
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {navItems.filter((item) => !item.authOnly || user).map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-4 py-2 text-sm font-bold transition hover:opacity-90"
                style={{
                  background: active ? c.primarySoft : 'transparent',
                  color: active ? c.primary : c.muted,
                  border: `1px solid ${active ? 'rgba(139,92,246,0.28)' : 'transparent'}`
                }}
              >
                {item.label}
              </Link>
            );
          })}
          {isAdmin && (
            <Link href="/admin" className="rounded-full px-4 py-2 text-sm font-bold" style={{ color: isActive('/admin') ? c.primary : c.muted }}>
              Admin
            </Link>
          )}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <>
              <Link
                href="/profile"
                data-testid="user-profile-link"
                className="inline-flex max-w-[190px] truncate rounded-full px-3 py-2 text-xs font-bold transition hover:opacity-90"
                style={{ background: c.surfaceElevated, color: c.textSecondary, border: `1px solid ${c.border}` }}
                title={user.email ?? undefined}
                aria-label="Open profile"
              >
                {displayLabel}
              </Link>
              <button onClick={handleSignOut} className="rounded-full px-3 py-2 text-xs font-bold transition hover:opacity-90" style={{ background: 'transparent', color: c.muted, border: `1px solid ${c.border}` }}>
                Sign out
              </button>
            </>
          ) : (
            <Link href="/login" className="mobile-action rounded-full px-5 py-2.5 text-sm font-black text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${c.primary}, ${c.secondary})`, boxShadow: c.glow }}>
              Login
            </Link>
          )}
        </div>

        <button
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          className="flex h-10 w-10 items-center justify-center rounded-full text-lg font-black transition md:hidden"
          style={{ background: c.surfaceElevated, color: c.txt, border: `1px solid ${c.border}` }}
        >
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      {menuOpen && (
        <div className="mx-4 mb-3 rounded-[24px] border p-2 shadow-2xl md:hidden" style={{ borderColor: c.border, background: c.surface, boxShadow: c.shadow }}>
          {navItems.filter((item) => !item.authOnly || user).map((item) => {
            const active = isActive(item.href);
            return (
              <Link key={item.href} href={item.href} onClick={close} className="flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-bold" style={{ background: active ? c.primarySoft : 'transparent', color: active ? c.primary : c.txt }}>
                {item.label}
                {active && <span className="h-2 w-2 rounded-full" style={{ background: c.primary }} />}
              </Link>
            );
          })}
          {user && (
            <Link href="/profile" onClick={close} className="flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-bold" style={{ color: c.txt }}>
              Profile
              <span className="max-w-[140px] truncate text-xs" style={{ color: c.muted }}>{displayLabel}</span>
            </Link>
          )}
          {isAdmin && <Link href="/admin" onClick={close} className="block rounded-2xl px-4 py-3 text-sm font-bold" style={{ color: c.muted }}>Admin</Link>}
          <div className="mt-2 border-t pt-2" style={{ borderColor: c.border }}>
            {user ? (
              <button onClick={handleSignOut} className="mobile-action w-full rounded-2xl px-4 py-3 text-left text-sm font-bold" style={{ color: c.muted }}>
                Sign out
              </button>
            ) : (
              <Link href="/login" onClick={close} className="mobile-action block rounded-2xl px-5 py-3 text-center text-sm font-black text-white" style={{ background: `linear-gradient(135deg, ${c.primary}, ${c.secondary})` }}>
                Login
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
