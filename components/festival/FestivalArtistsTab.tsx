import { LiveBadge } from '@/components/LiveBadge';
import type { ArtistRosterItem, PerformanceItem, PreferenceStatus } from '@/lib/festivalTypes';
import type { getThemeColors } from '@/lib/platform';

interface FestivalArtistsTabProps {
  artistRoster: ArtistRosterItem[];
  nowPlayingIds: Set<number>;
  loading: boolean;
  onToggleArtistStar: (artist: ArtistRosterItem) => void;
  c: ReturnType<typeof getThemeColors>;
}

export function FestivalArtistsTab({ artistRoster, nowPlayingIds, loading, onToggleArtistStar, c }: FestivalArtistsTabProps) {
  return (
    <div data-testid="artists-tab">
      {artistRoster.length === 0 && !loading && (
        <p className="mt-4 text-sm" style={{ color: c.muted }}>No artists found.</p>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
        {artistRoster.map((artist) => {
          const isAll = artist.starState === 'all';
          const isMixed = artist.starState === 'mixed';
          const isAnyLive = artist.performances.some((p) => nowPlayingIds.has(p.id));
          const dayLabels = Array.from(new Set(artist.performances.map((p) => p.dayDate)))
            .sort()
            .map((d) => new Date(d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }));
          return (
            <article
              key={artist.artistName}
              data-testid="lineup-artist-row"
              className="overflow-hidden rounded-2xl"
              style={{
                background: c.surf,
                border: `1px solid ${isAnyLive ? '#ef444433' : isAll ? `${c.star}44` : c.brd}`,
                boxShadow: isAnyLive ? '0 0 14px rgba(239,68,68,0.15)' : isAll ? `0 0 14px ${c.star}12` : 'none',
              }}
            >
              <div className="flex items-center gap-2 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="truncate text-sm font-bold leading-snug" style={{ color: c.txt }}>
                      {artist.artistName}
                    </h3>
                    {isAnyLive && <LiveBadge compact />}
                  </div>
                  <p className="text-[11px] mt-0.5 truncate" style={{ color: c.muted }}>
                    {artist.performances.length} set{artist.performances.length !== 1 ? 's' : ''}
                    {' · '}{dayLabels.join(', ')}
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="lineup-artist-star"
                  onClick={() => onToggleArtistStar(artist)}
                  aria-label={isAll ? `Unstar all sets by ${artist.artistName}` : `Star all sets by ${artist.artistName}`}
                  className="inline-flex items-center justify-center rounded-full font-black transition"
                  style={{
                    width: 36,
                    height: 36,
                    background: isAll ? c.star : isMixed ? `${c.star}55` : 'rgba(0,0,0,.38)',
                    color: isAll ? '#0f0f00' : 'rgba(255,255,255,0.9)',
                    border: `1.5px solid ${isAll || isMixed ? c.star : 'rgba(255,255,255,.22)'}`,
                    boxShadow: isAll ? `0 0 16px ${c.star}66, inset 0 1px 0 rgba(255,255,255,.2)` : 'none',
                    flexShrink: 0,
                    opacity: isMixed ? 0.75 : 1,
                    fontSize: 14,
                  }}
                >
                  {isAll || isMixed ? '★' : '☆'}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
