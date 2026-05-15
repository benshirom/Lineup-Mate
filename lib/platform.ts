export type Language = 'en' | 'he';
export type ThemeMode = 'light' | 'dark';

export const translations = {
  en: {
    appName: 'Lineup·Mate',
    navEvents: 'Events',
    navMySchedule: 'My Schedule',
    navGroups: 'Groups',
    navSettings: 'Settings',
    navProfile: 'Profile',
    heroTitle: 'Never miss a set again.',
    heroSub: 'Discover festivals, star your artists, plan with friends.',
    browseEvents: 'Browse Events',
    upcomingEvents: 'Upcoming Events',
    searchEvents: 'Search events…',
    all: 'All',
    psytrance: 'Psytrance',
    electronic: 'Electronic',
    multiGenre: 'Multi-genre',
    viewLineup: 'View Lineup',
    saveFestival: 'Save Festival',
    saved: 'Saved!',
    remove: 'Remove',
    artists: 'artists',
    stages: 'stages',
    days: 'days',
    signInToSave: 'Sign in to save festivals and build your schedule.',
    importSync: 'Import / Sync'
  },
  he: {
    appName: 'Lineup·Mate',
    navEvents: 'אירועים',
    navMySchedule: 'הלוח שלי',
    navGroups: 'קבוצות',
    navSettings: 'הגדרות',
    navProfile: 'פרופיל',
    heroTitle: 'לעולם לא תפספס הופעה.',
    heroSub: 'גלה פסטיבלים, סמן אמנים, תכנן עם חברים.',
    browseEvents: 'גלה אירועים',
    upcomingEvents: 'אירועים קרובים',
    searchEvents: 'חפש אירועים…',
    all: 'הכל',
    psytrance: 'פסיטראנס',
    electronic: 'אלקטרוני',
    multiGenre: 'מולטי-ז׳אנר',
    viewLineup: 'צפה בליינאפ',
    saveFestival: 'שמור פסטיבל',
    saved: 'נשמר!',
    remove: 'הסר',
    artists: 'אמנים',
    stages: 'במות',
    days: 'ימים',
    signInToSave: 'התחבר כדי לשמור פסטיבלים ולבנות לוח אישי.',
    importSync: 'ייבוא / סנכרון'
  }
} as const;

export const genreFilters = [
  { key: 'all', en: 'All', he: 'הכל' },
  { key: 'psy', en: 'Psytrance', he: 'פסיטראנס' },
  { key: 'elec', en: 'Electronic', he: 'אלקטרוני' },
  { key: 'multi', en: 'Multi-genre', he: 'מולטי-ז׳אנר' }
] as const;

export function getThemeColors(theme: ThemeMode) {
  return theme === 'dark'
    ? {
        mode: 'dark' as const,
        bg: '#0d0d1c',
        surf: '#14142a',
        surf2: '#1c1c34',
        brd: '#2c2c4c',
        txt: '#eeeeff',
        muted: '#8787aa',
        acc: '#e85d26',
        accB: '#7c4fd4'
      }
    : {
        mode: 'light' as const,
        bg: '#f3f0ea',
        surf: '#ffffff',
        surf2: '#eceae3',
        brd: '#d4cfc5',
        txt: '#1a1a10',
        muted: '#7a7060',
        acc: '#c44e18',
        accB: '#5c32b0'
      };
}

export function formatDateRange(start?: string | null, end?: string | null) {
  if (!start && !end) return 'Dates TBA';
  const startLabel = start ? new Date(start).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
  const endLabel = end ? new Date(end).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
  return `${startLabel} – ${endLabel}`;
}
