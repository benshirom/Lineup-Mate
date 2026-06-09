export type PreferenceStatus = 'going' | 'maybe' | 'not_interested';
export type FestivalTab = 'artists' | 'lineup' | 'timeline' | 'info';

export interface Festival {
  id: number;
  name: string;
  name_he?: string | null;
  year: number;
  location: string | null;
  location_he?: string | null;
  start_date: string | null;
  end_date: string | null;
  description?: string | null;
  description_he?: string | null;
  website?: string | null;
  emoji?: string | null;
  color?: string | null;
  genre?: string | null;
  genre_label?: string | null;
  clashfinder_slug?: string | null;
  last_synced_at?: string | null;
}

export interface PerformanceItem {
  id: number;
  artistName: string;
  stageName: string;
  stageColor: string;
  startTime: string;
  endTime: string;
  dayDate: string;
  status: PreferenceStatus | null;
}

export interface ArtistRosterItem {
  artistName: string;
  performances: PerformanceItem[];
  starState: 'all' | 'none' | 'mixed';
}
