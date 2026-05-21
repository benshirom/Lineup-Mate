import React from 'react';
import { typography } from '@/lib/platform';

interface BrandHeadingProps {
  as?: 'h1' | 'h2' | 'h3';
  children: React.ReactNode;
  className?: string;
  tight?: boolean;
  lineHeight?: number;
}

export default function BrandHeading({ as = 'h2', children, className = '', tight = false, lineHeight }: BrandHeadingProps) {
  const Component = as;

  return (
    <Component
      className={className}
      style={{
        fontFamily: typography.display,
        letterSpacing: tight ? typography.tight : undefined,
        lineHeight
      }}
    >
      {children}
    </Component>
  );
}
