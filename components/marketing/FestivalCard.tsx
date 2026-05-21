import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import { formatDateRange, getThemeColors } from '@/lib/platform';

export interface FestivalCardFestival {
  id: number;
  name: string;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  color?: string | null;
  genre?: string | null;
  genre_label?: string | null;
}

export interface FestivalCardStats {
  performances: number;
  stages: number;
  days: number;
}

interface FestivalCardProps {
  festival: FestivalCardFestival;
  stats: FestivalCardStats;
  isSaved: boolean;
  onToggleSaved: (festivalId: number) => void;
  onOpen: (festivalId: number) => void;
}

export default function FestivalCard({ festival, stats, isSaved, onToggleSaved, onOpen }: FestivalCardProps) {
  const { theme, t } = useAuth();
  const c = getThemeColors(theme);
  const accent = festival.color || c.acc;

  return (
    <article data-testid="festival-card" className="fade-up overflow-hidden rounded-[24px] shadow-xl transition hover:-translate-y-1 hover:shadow-2xl" style={{ background: c.surf, border: `1px solid ${c.brd}`, borderTop: `2px solid ${accent}` }}>
      <div className="p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-black shadow-sm" style={{ background: `${accent}18`, border: `1px solid ${accent}33`, color: accent }}>
              {(festival.name || 'F').slice(0, 1).toUpperCase()}
            </div>
            <div>
              <h3 className="text-base font-black leading-snug" style={{ fontFamily: 'Space Grotesk, Inter, sans-serif', letterSpacing: '-0.01em' }}>{festival.name}</h3>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.12em]" style={{ color: accent }}>{festival.genre_label || festival.genre || 'Festival'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onToggleSaved(festival.id)}
            className="shrink-0 rounded-full px-2.5 py-1 text-xs font-extrabold transition"
            style={{ background: isSaved ? `${c.acc}22` : c.surf2, color: isSaved ? c.acc : c.muted, border: `1px solid ${isSaved ? c.acc : c.brd}` }}
          >
            {isSaved ? '✓ Saved' : '+ Save'}
          </button>
        </div>

        <div className="mb-4 space-y-1 text-xs" style={{ color: c.muted }}>
          <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full" style={{ background: c.accB }} /><span className="truncate">{festival.location || 'Location TBA'}</span></div>
          <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full" style={{ background: c.star }} /><span>{formatDateRange(festival.start_date, festival.end_date)}</span></div>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-1.5 text-center text-xs">
          <div className="rounded-xl py-2" style={{ background: c.surf2 }}><b className="block text-base font-black" style={{ color: c.txt }}>{stats.performances}</b><span style={{ color: c.muted }}>{t.artists}</span></div>
          <div className="rounded-xl py-2" style={{ background: c.surf2 }}><b className="block text-base font-black" style={{ color: c.txt }}>{stats.stages}</b><span style={{ color: c.muted }}>{t.stages}</span></div>
          <div className="rounded-xl py-2" style={{ background: c.surf2 }}><b className="block text-base font-black" style={{ color: c.txt }}>{stats.days}</b><span style={{ color: c.muted }}>{t.days}</span></div>
        </div>

        <button
          type="button"
          onClick={() => onOpen(festival.id)}
          className="w-full rounded-2xl px-4 py-3 text-sm font-black text-white transition hover:brightness-110"
          style={{ background: c.acc, boxShadow: `0 4px 16px ${c.acc}33` }}
        >
          {t.viewLineup}
        </button>
      </div>
    </article>
  );
}
