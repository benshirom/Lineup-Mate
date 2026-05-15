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
      style={{ background: c.surf, borderTop: `1px solid ${c.brd}`, height: '56px' }}
    >
      {items.map(({ href, icon, label }) => {
        const active = router.pathname === href || (href !== '/' && router.pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 py-1 text-[10px] font-black transition-opacity hover:opacity-80"
            style={{ color: active ? c.acc : c.muted }}
          >
            <span className="text-xl leading-none">{icon}</span>
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
};

export default BottomNav;
