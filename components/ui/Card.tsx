import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getThemeColors } from '@/lib/platform';

interface CardProps {
  variant?: 'default' | 'elevated' | 'flat';
  padding?: 'sm' | 'md' | 'lg' | 'none';
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

const paddingMap = { none: '0', sm: '16px', md: '20px', lg: '28px' };

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  padding = 'md',
  className = '',
  style,
  children,
}) => {
  const { theme } = useAuth();
  const c = getThemeColors(theme);

  const bgMap = {
    default: c.surface,
    elevated: c.surfaceElevated,
    flat: c.surfaceHover,
  };

  const shadowMap = {
    default: '0 4px 24px rgba(0,0,0,0.18)',
    elevated: '0 18px 48px rgba(0,0,0,0.32)',
    flat: 'none',
  };

  return (
    <div
      className={`overflow-hidden rounded-3xl ${className}`}
      style={{
        background: bgMap[variant],
        border: `1px solid ${c.border}`,
        boxShadow: shadowMap[variant],
        padding: paddingMap[padding],
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export default Card;
