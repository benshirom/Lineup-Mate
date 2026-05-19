import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import { createDesignSystem, type BadgeVariant } from '@/lib/designSystem';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'muted', children, className = '' }) => {
  const { theme } = useAuth();
  const ds = createDesignSystem(theme);
  const variantStyle = ds.badge.variants[variant];

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${className}`}
      style={{ ...variantStyle, border: `1px solid ${variantStyle.borderColor}` }}
    >
      {children}
    </span>
  );
};

export default Badge;
