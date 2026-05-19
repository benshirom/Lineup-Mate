import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getThemeColors } from '@/lib/platform';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  children,
  disabled,
  className = '',
  style,
  ...rest
}) => {
  const { theme } = useAuth();
  const c = getThemeColors(theme);

  const bgMap: Record<Variant, string> = {
    primary: c.primary,
    secondary: c.secondary,
    ghost: 'transparent',
    danger: c.danger,
  };

  const colorMap: Record<Variant, string> = {
    primary: '#fff',
    secondary: '#fff',
    ghost: c.muted,
    danger: '#fff',
  };

  const borderMap: Record<Variant, string> = {
    primary: c.primary,
    secondary: c.secondary,
    ghost: c.border,
    danger: c.danger,
  };

  const heightMap: Record<Size, number> = { sm: 36, md: 44, lg: 52 };
  const paddingMap: Record<Size, string> = { sm: '0 14px', md: '0 20px', lg: '0 28px' };
  const fontSizeMap: Record<Size, string> = { sm: '12px', md: '14px', lg: '15px' };

  return (
    <button
      disabled={disabled || loading}
      className={`tap-active inline-flex items-center justify-center font-bold transition-all disabled:opacity-50 ${className}`}
      style={{
        background: bgMap[variant],
        color: colorMap[variant],
        border: `1px solid ${borderMap[variant]}`,
        borderRadius: 14,
        minHeight: heightMap[size],
        padding: paddingMap[size],
        fontSize: fontSizeMap[size],
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        ...style,
      }}
      {...rest}
    >
      {loading ? '…' : children}
    </button>
  );
};

export default Button;
