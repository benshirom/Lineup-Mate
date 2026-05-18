export type ThemeMode = 'light' | 'dark';

export const translations = {
  appName: 'Lineup·Mate',
  navEvents: 'Festivals',
  navMySchedule: 'My Schedule',
  navGroups: 'Groups',
  navSettings: 'Settings',
  navProfile: 'Profile',
  heroTitle: 'Plan your festival schedule. Together.',
  heroSub: 'Explore lineups, save your favorite artists, avoid time conflicts, and coordinate plans with friends.',
  browseEvents: 'Explore festivals',
  upcomingEvents: 'Festivals to plan',
  searchEvents: 'Search festivals, locations or genres…',
  all: 'All',
  psytrance: 'Psytrance',
  electronic: 'Electronic',
  multiGenre: 'Multi-genre',
  viewLineup: 'Open schedule',
  saveFestival: 'Save festival',
  saved: 'Saved',
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
  const dark = {
    mode: 'dark' as const,
    bg: '#080B12',
    bgSoft: '#0D111A',
    surf: '#111827',
    surf2: '#151E2E',
    surf3: '#1B2638',
    surface: '#111827',
    surfaceElevated: '#151E2E',
    surfaceHover: '#1B2638',
    brd: '#273244',
    border: '#273244',
    borderSoft: '#1E293B',
    txt: '#F8FAFC',
    text: '#F8FAFC',
    textSecondary: '#CBD5E1',
    muted: '#94A3B8',
    disabled: '#64748B',
    acc: '#8B5CF6',
    accB: '#06B6D4',
    primary: '#8B5CF6',
    primaryHover: '#7C3AED',
    primarySoft: 'rgba(139, 92, 246, 0.14)',
    secondary: '#06B6D4',
    secondarySoft: 'rgba(6, 182, 212, 0.14)',
    success: '#22C55E',
    warning: '#F59E0B',
    danger: '#EF4444',
    star: '#FACC15',
    shadow: '0 18px 48px rgba(0,0,0,0.28)',
    glow: '0 0 32px rgba(139,92,246,0.20)'
  };

  const light = {
    mode: 'light' as const,
    bg: '#F8FAFC',
    bgSoft: '#F1F5F9',
    surf: '#FFFFFF',
    surf2: '#FFFFFF',
    surf3: '#F1F5F9',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    surfaceHover: '#F1F5F9',
    brd: '#E2E8F0',
    border: '#E2E8F0',
    borderSoft: '#EEF2F7',
    txt: '#0F172A',
    text: '#0F172A',
    textSecondary: '#334155',
    muted: '#64748B',
    disabled: '#94A3B8',
    acc: '#7C3AED',
    accB: '#0891B2',
    primary: '#7C3AED',
    primaryHover: '#6D28D9',
    primarySoft: 'rgba(124, 58, 237, 0.10)',
    secondary: '#0891B2',
    secondarySoft: 'rgba(8, 145, 178, 0.10)',
    success: '#16A34A',
    warning: '#D97706',
    danger: '#DC2626',
    star: '#CA8A04',
    shadow: '0 18px 44px rgba(15,23,42,0.10)',
    glow: '0 0 28px rgba(124,58,237,0.14)'
  };

  return theme === 'dark' ? dark : light;
}

export function formatDateRange(start?: string | null, end?: string | null) {
  if (!start && !end) return 'Dates TBA';
  const startLabel = start ? new Date(start).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
  const endLabel = end ? new Date(end).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
  return `${startLabel} – ${endLabel}`;
}
