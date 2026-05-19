import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import { createDesignSystem, type ButtonSize, type ButtonVariant } from '@/lib/designSystem';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
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
  const ds = createDesignSystem(theme);
  const variantStyle = ds.button.variants[variant];
  const sizeStyle = ds.button.sizes[size];

  return (
    <button
      disabled={disabled || loading}
      className={`tap-active inline-flex items-center justify-center font-bold transition-all disabled:opacity-50 ${className}`}
      style={{
        ...variantStyle,
        ...sizeStyle,
        border: `1px solid ${variantStyle.borderColor}`,
        borderRadius: ds.radii.control,
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
