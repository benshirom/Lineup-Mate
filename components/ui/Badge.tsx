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
    primary:   { bg: c.accSoft,  color: c.acc,     border: `${c.acc}44` },
    secondary: { bg: c.accBSoft, color: c.accB,    border: `${c.accB}44` },
    success:   { bg: 'rgba(34,197,94,0.14)',  color: c.success, border: 'rgba(34,197,94,0.4)' },
    warning:   { bg: 'rgba(245,158,11,0.14)', color: c.warning, border: 'rgba(245,158,11,0.4)' },
    danger:    { bg: 'rgba(239,68,68,0.14)',  color: c.danger,  border: 'rgba(239,68,68,0.4)' },
    star:      { bg: 'rgba(250,204,21,0.14)', color: c.star,    border: 'rgba(250,204,21,0.4)' },
    muted:     { bg: c.surf2,    color: c.muted,   border: c.brd },
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
