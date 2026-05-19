import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
import { createDesignSystem } from '@/lib/designSystem';

const items = [
  { href: '/', icon: 'F', label: 'Festivals' },
  { href: '/my-schedule', icon: 'S', label: 'Schedule' },
  { href: '/groups', icon: 'G', label: 'Groups' },
  { href: '/profile', icon: 'P', label: 'Profile' },
];

const BottomNav: React.FC = () => {
  const { theme } = useAuth();
  const ds = createDesignSystem(theme);
  const router = useRouter();

  return (
    <nav
      className="glass-nav md:hidden fixed bottom-0 inset-x-0 z-40 flex justify-around items-stretch pb-safe"
      style={{
        background: `${ds.colors.surface}f4`,
        borderTop: `1px solid ${ds.colors.border}`,
        minHeight: '60px',
      }}
    >
      {items.map(({ href, icon, label }) => {
        const active = router.pathname === href || (href !== '/' && router.pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className="tap-active relative flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] font-bold transition-colors"
            style={{ color: active ? ds.colors.primary : ds.colors.muted, minHeight: 60 }}
          >
            {active && (
              <span
                className="absolute inset-x-2 top-1 bottom-1 rounded-2xl"
                style={{ background: ds.colors.primarySoft }}
              />
            )}
            <span
              className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black leading-none"
              style={{
                background: active ? ds.colors.primary : ds.colors.surfaceElevated,
                color: active ? '#fff' : ds.colors.muted,
                boxShadow: active ? ds.shadows.glowPrimary : 'none',
                border: `1px solid ${active ? ds.colors.primary : ds.colors.border}`,
              }}
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
