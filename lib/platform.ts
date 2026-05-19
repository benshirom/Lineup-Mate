export type ThemeMode = 'light' | 'dark';

export const translations = {
  appName: 'Lineup·Mate',
  navEvents: 'Events',
  navMySchedule: 'My Schedule',
  navGroups: 'Groups',
  navSettings: 'Settings',
  navProfile: 'Profile',
  heroTitle: 'Plan your festival schedule. Together.',
  heroSub: 'Explore lineups, save your favorite artists, avoid time conflicts, and coordinate plans with friends.',
  browseEvents: 'Explore Festivals',
  upcomingEvents: 'Upcoming Events',
  searchEvents: 'Search events…',
  all: 'All',
  psytrance: 'Psytrance',
  electronic: 'Electronic',
  multiGenre: 'Multi-genre',
  viewLineup: 'Open Schedule',
  saveFestival: 'Save Festival',
  saved: 'Saved!',
  remove: 'Remove',
  artists: 'artists',
  stages: 'stages',
  days: 'days',
  signInToSave: 'Sign in to build your personal lineup and sync plans with friends.',
  importSync: 'Import / Sync'
} as const;

export const genreFilters = [
  { key: 'all', label: 'All' },
  { key: 'psy', label: 'Psytrance' },
  { key: 'elec', label: 'Electronic' },
  { key: 'multi', label: 'Multi-genre' }
] as const;

export function getThemeColors(theme: ThemeMode) {
  if (theme === 'dark') {
    const palette = {
      mode: 'dark' as const,
      bg: '#080B12',
      bgSoft: '#0D111A',
      surf: '#111827',
      surf2: '#151E2E',
      surf3: '#1B2638',
      brd: '#273244',
      brdSoft: '#1E293B',
      txt: '#F8FAFC',
      txtSec: '#CBD5E1',
      muted: '#94A3B8',
      disabled: '#64748B',
      acc: '#8B5CF6',
      accHover: '#7C3AED',
      accSoft: 'rgba(139,92,246,0.14)',
      accB: '#06B6D4',
      accBSoft: 'rgba(6,182,212,0.14)',
      success: '#22C55E',
      warning: '#F59E0B',
      danger: '#EF4444',
      star: '#FACC15',
    };

    return {
      ...palette,
      surface: palette.surf,
      surfaceElevated: palette.surf2,
      surfaceHover: palette.surf3,
      border: palette.brd,
      borderSoft: palette.brdSoft,
      text: palette.txt,
      textSecondary: palette.txtSec,
      primary: palette.acc,
      primaryHover: palette.accHover,
      primarySoft: palette.accSoft,
      secondary: palette.accB,
      secondarySoft: palette.accBSoft,
    };
  }

  const palette = {
    mode: 'light' as const,
    bg: '#F8FAFC',
    bgSoft: '#F1F5F9',
    surf: '#FFFFFF',
    surf2: '#FFFFFF',
    surf3: '#F1F5F9',
    brd: '#E2E8F0',
    brdSoft: '#EEF2F7',
    txt: '#0F172A',
    txtSec: '#334155',
    muted: '#64748B',
    disabled: '#94A3B8',
    acc: '#7C3AED',
    accHover: '#6D28D9',
    accSoft: 'rgba(124,58,237,0.10)',
    accB: '#0891B2',
    accBSoft: 'rgba(8,145,178,0.10)',
    success: '#16A34A',
    warning: '#D97706',
    danger: '#DC2626',
    star: '#CA8A04',
  };

  return {
    ...palette,
    surface: palette.surf,
    surfaceElevated: palette.surf2,
    surfaceHover: palette.surf3,
    border: palette.brd,
    borderSoft: palette.brdSoft,
    text: palette.txt,
    textSecondary: palette.txtSec,
    primary: palette.acc,
    primaryHover: palette.accHover,
    primarySoft: palette.accSoft,
    secondary: palette.accB,
    secondarySoft: palette.accBSoft,
  };
}

export function formatDateRange(start?: string | null, end?: string | null) {
  if (!start && !end) return 'Dates TBA';
  const startLabel = start ? new Date(start).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
  const endLabel = end ? new Date(end).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
  return `${startLabel} – ${endLabel}`;
}
