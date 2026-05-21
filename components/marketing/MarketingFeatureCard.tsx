import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getThemeColors } from '@/lib/platform';

interface MarketingFeatureCardProps {
  index: number;
  eyebrow: string;
  title: string;
  body: string;
}

export default function MarketingFeatureCard({ index, eyebrow, title, body }: MarketingFeatureCardProps) {
  const { theme } = useAuth();
  const c = getThemeColors(theme);
  const accent = index === 1 ? c.warning : index === 2 ? c.accB : c.acc;

  return (
    <article className="rounded-[24px] p-5" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
      <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full text-sm font-black" style={{ background: `${accent}1f`, color: accent }}>
        {index + 1}
      </div>
      <p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: c.muted }}>{eyebrow}</p>
      <h3 className="mt-1 text-xl font-black">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: c.muted }}>{body}</p>
    </article>
  );
}
