import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getThemeColors } from '@/lib/platform';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  accent?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ eyebrow, title, description, actions, accent }) => {
  const { theme } = useAuth();
  const c = getThemeColors(theme);

  return (
    <header className="mb-6">
      {eyebrow && (
        <p
          className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em]"
          style={{ color: accent || c.primary }}
        >
          {eyebrow}
        </p>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1
            className="text-2xl font-extrabold leading-tight sm:text-3xl"
            style={{ color: c.text, letterSpacing: '-0.02em' }}
          >
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm leading-relaxed" style={{ color: c.muted }}>
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
};

export default PageHeader;
