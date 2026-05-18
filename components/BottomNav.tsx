import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
import { getThemeColors } from '@/lib/platform';

const items = [
  { href: '/', icon: 'Home', label: 'Festivals' },
  { href: '/my-schedule', icon: 'Star', label: 'Schedule' },
  { href: '/groups', icon: 'Team', label: 'Groups' },
  { href: '/profile', icon: 'User', label: 'Profile' }
];

const BottomNav: React.FC = () => {
  const { theme } = useAuth();
  const c = getThemeColors(theme);
  const router = useRouter();

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-50 px-3 pb-safe pt-2"
      style={{ background: 'linear-gradient(180deg, rgba(8,11,18,0), rgba(8,11,18,0.94) 24%)' }}
      aria-label="Mobile navigation"
    >
      <div
        className="mx-auto grid max-w-md grid-cols-4 rounded-[24px] border px-1.5 py-1.5 shadow-2xl"
        style={{ background: 'rgba(17,24,39,0.92)', borderColor: 'rgba(148,163,184,0.18)', backdropFilter: 'blur(18px)', boxShadow: c.shadow }}
      >
        {items.map(({ href, icon, label }) => {
          const active = router.pathname === href || (href !== '/' && router.pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className="relative flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-[18px] text-[10px] font-black transition-all"
              style={{
                background: active ? c.primarySoft : 'transparent',
                color: active ? c.primary : c.muted,
                border: `1px solid ${active ? 'rgba(139,92,246,0.26)' : 'transparent'}`
              }}
              aria-current={active ? 'page' : undefined}
            >
              <span className="text-[11px] leading-none">{icon}</span>
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
