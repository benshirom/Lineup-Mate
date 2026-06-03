import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/lib/AuthContext';
import { getThemeColors } from '@/lib/platform';

const NAV_LINKS = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/groups', label: 'Groups' },
  { href: '/admin', label: 'Import' },
];

interface AdminLayoutProps {
  title: string;
  children: React.ReactNode;
}

export default function AdminLayout({ title, children }: AdminLayoutProps) {
  const { user, profile, authReady, theme } = useAuth();
  const router = useRouter();
  const c = getThemeColors(theme);

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      router.push('/');
      return;
    }
    // profile is loaded asynchronously after authReady; wait for it
    if (profile !== null && profile.role !== 'admin') {
      router.push('/');
    }
  }, [authReady, user, profile, router]);

  if (!authReady || !user || profile === null) {
    return (
      <div style={{ minHeight: '100vh', background: c.bg, color: c.txt }}>
        <Navbar />
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80, color: c.muted }}>
          Loading…
        </div>
      </div>
    );
  }

  if (profile.role !== 'admin') {
    return null;
  }

  return (
    <div style={{ minHeight: '100vh', background: c.bg, color: c.txt }}>
      <Navbar />

      {/* Sub-navigation */}
      <div style={{ background: c.surf, borderBottom: `1px solid ${c.brd}` }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px', display: 'flex', gap: 8, overflowX: 'auto' as const }}>
          {NAV_LINKS.map((link) => {
            const isActive = router.pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  display: 'inline-block',
                  padding: '10px 16px',
                  fontSize: 14,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? '#fff' : c.txt,
                  background: isActive ? c.acc : 'transparent',
                  borderRadius: 0,
                  borderBottom: isActive ? `2px solid ${c.acc}` : '2px solid transparent',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap' as const,
                  transition: 'background 0.15s',
                }}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Page content */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 16px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, color: c.txt }}>{title}</h1>
        {children}
      </div>
    </div>
  );
}
