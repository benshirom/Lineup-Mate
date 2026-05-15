import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
import { getThemeColors } from '@/lib/platform';

const items = [
  { href: '/', icon: '🎪', label: 'Home' },
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
      className="md:hidden fixed bottom-0 inset-x-0 z-40 flex justify-around items-center px-2 pb-safe"
      style={{ background: c.surf, borderTop: `1px solid ${c.brd}`, height: '56px', backdropFilter: 'blur(12px)' }}
    >
      {items.map(({ href, icon, label }) => {
        const active = router.pathname === href || (href !== '/' && router.pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className="relative flex flex-1 flex-col items-center justify-center gap-0.5 py-1 text-[10px] font-black transition-all"
            style={{ color: active ? c.acc : c.muted }}
          >
            {active && (
              <span
                className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-6 rounded-full"
                style={{ background: c.acc, boxShadow: `0 0 8px ${c.acc}` }}
              />
            )}
            <span className="text-xl leading-none" style={{ filter: active ? `drop-shadow(0 0 4px ${c.acc}88)` : 'none' }}>{icon}</span>
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
};

export default BottomNav;
