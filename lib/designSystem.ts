// Component-layer design tokens. Builds on getThemeColors() from platform.ts.
// Use this in shared UI components; use getThemeColors() directly in pages.
import type { CSSProperties } from 'react';
import { getThemeColors, type ThemeMode } from '@/lib/platform';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type CardVariant = 'default' | 'elevated' | 'flat';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';
export type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'star' | 'muted';

export function createDesignSystem(theme: ThemeMode) {
  const c = getThemeColors(theme);

  const radii = {
    control: 14,
    card: 24,
    modal: 28,
    pill: 999,
  } as const;

  const shadows = {
    card: '0 4px 24px rgba(0,0,0,0.18)',
    elevated: '0 18px 48px rgba(0,0,0,0.32)',
    glowPrimary: `0 0 32px ${c.primary}33`,
  } as const;

  const typography = {
    heading: 'Space Grotesk, Inter, ui-sans-serif, system-ui, sans-serif',
    body: 'Inter, ui-sans-serif, system-ui, sans-serif',
  } as const;

  const button = {
    sizes: {
      sm: { minHeight: 36, padding: '0 14px', fontSize: '12px' },
      md: { minHeight: 44, padding: '0 20px', fontSize: '14px' },
      lg: { minHeight: 52, padding: '0 28px', fontSize: '15px' },
    } satisfies Record<ButtonSize, CSSProperties>,
    variants: {
      primary: { background: c.primary, color: '#fff', borderColor: c.primary },
      secondary: { background: c.secondary, color: '#fff', borderColor: c.secondary },
      ghost: { background: 'transparent', color: c.muted, borderColor: c.border },
      danger: { background: c.danger, color: '#fff', borderColor: c.danger },
    } satisfies Record<ButtonVariant, CSSProperties>,
  } as const;

  const card = {
    padding: {
      none: '0',
      sm: '16px',
      md: '20px',
      lg: '28px',
    } satisfies Record<CardPadding, string>,
    variants: {
      default: { background: c.surface, boxShadow: shadows.card },
      elevated: { background: c.surfaceElevated, boxShadow: shadows.elevated },
      flat: { background: c.surfaceHover, boxShadow: 'none' },
    } satisfies Record<CardVariant, CSSProperties>,
  } as const;

  const badge = {
    variants: {
      primary: { background: c.primarySoft, color: c.primary, borderColor: `${c.primary}44` },
      secondary: { background: c.secondarySoft, color: c.secondary, borderColor: `${c.secondary}44` },
      success: { background: 'rgba(34,197,94,0.14)', color: c.success, borderColor: 'rgba(34,197,94,0.4)' },
      warning: { background: 'rgba(245,158,11,0.14)', color: c.warning, borderColor: 'rgba(245,158,11,0.4)' },
      danger: { background: 'rgba(239,68,68,0.14)', color: c.danger, borderColor: 'rgba(239,68,68,0.4)' },
      star: { background: 'rgba(250,204,21,0.14)', color: c.star, borderColor: 'rgba(250,204,21,0.4)' },
      muted: { background: c.surfaceElevated, color: c.muted, borderColor: c.border },
    } satisfies Record<BadgeVariant, CSSProperties>,
  } as const;

  const stageFilter = {
    neutralBackground: c.surfaceElevated,
    hoverBackground: c.surfaceHover,
    text: c.textSecondary,
    border: c.border,
  } as const;

  return {
    colors: c,
    radii,
    shadows,
    typography,
    button,
    card,
    badge,
    stageFilter,
  } as const;
}

export type DesignSystem = ReturnType<typeof createDesignSystem>;
