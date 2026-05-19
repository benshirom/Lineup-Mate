import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getThemeColors } from '@/lib/platform';

type Variant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'star' | 'muted';

interface BadgeProps {
  variant?: Variant;
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'muted', children, className = '' }) => {
  const { theme } = useAuth();
  const c = getThemeColors(theme);

  const styles: Record<Variant, { bg: string; color: string; border: string }> = {
    primary: { bg: c.primarySoft, color: c.primary, border: `${c.primary}44` },
    secondary: { bg: c.secondarySoft, color: c.secondary, border: `${c.secondary}44` },
    success: { bg: 'rgba(34,197,94,0.14)', color: c.success, border: 'rgba(34,197,94,0.4)' },
    warning: { bg: 'rgba(245,158,11,0.14)', color: c.warning, border: 'rgba(245,158,11,0.4)' },
    danger: { bg: 'rgba(239,68,68,0.14)', color: c.danger, border: 'rgba(239,68,68,0.4)' },
    star: { bg: 'rgba(250,204,21,0.14)', color: c.star, border: 'rgba(250,204,21,0.4)' },
    muted: { bg: c.surfaceElevated, color: c.muted, border: c.border },
  };

  const s = styles[variant];

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${className}`}
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {children}
    </span>
  );
};

export default Badge;
