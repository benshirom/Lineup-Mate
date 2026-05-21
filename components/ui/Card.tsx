import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import { createDesignSystem, type CardPadding, type CardVariant } from '@/lib/designSystem';

interface CardProps {
  variant?: CardVariant;
  padding?: CardPadding;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  padding = 'md',
  className = '',
  style,
  children,
}) => {
  const { theme } = useAuth();
  const ds = createDesignSystem(theme);
  const variantStyle = ds.card.variants[variant];

  return (
    <div
      className={`overflow-hidden ${className}`}
      style={{
        ...variantStyle,
        border: `1px solid ${ds.colors.border}`,
        borderRadius: ds.radii.card,
        padding: ds.card.padding[padding],
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export default Card;
