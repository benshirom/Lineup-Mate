import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
import { getThemeColors } from '@/lib/platform';

const items = [
  { href: '/', icon: '🎪', label: 'Festivals' },
  { href: '/my-schedule', icon: '⭐', label: 'Schedule' },
  { href: '/groups', icon: '👥', label: 'Groups' },
  { href: '/profile', icon: '👤', label: 'Profile' },
];

const BottomNav: React.FC = () => {
  const { theme } = useAuth();
  const c = getThemeColors(theme);
  const router = useRouter();

  return (
    <nav
      className="glass-nav md:hidden fixed bottom-0 inset-x-0 z-40 flex justify-around items-stretch pb-safe"
      style={{
        background: `${c.surf}f4`,
        borderTop: `1px solid ${c.brd}`,
        minHeight: '60px',
      }}
    >
      {items.map(({ href, icon, label }) => {
        const active = router.pathname === href || (href !== '/' && router.pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className="tap-active relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-bold transition-colors"
            style={{ color: active ? c.acc : c.muted, minHeight: 60 }}
          >
            {active && (
              <span
                className="absolute inset-x-2 top-1 bottom-1 rounded-2xl"
                style={{ background: `${c.acc}18` }}
              />
            )}
            <span
              className="relative z-10 text-xl leading-none"
              style={{ filter: active ? `drop-shadow(0 0 6px ${c.acc}99)` : 'none' }}
            >
              {icon}
            </span>
            <span className="relative z-10">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
};

export default BottomNav;
