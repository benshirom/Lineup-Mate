import crypto from 'crypto';

export interface NormalizedClashfinderPerformance {
  artistName: string;
  stageName: string;
  startTime: string;
  endTime: string;
  dayDate: string;
}

export interface NormalizedClashfinderEvent {
  slug: string;
  name: string;
  year: number;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  performances: NormalizedClashfinderPerformance[];
  raw: unknown;
}

interface ParseContext {
  stageName?: string | null;
  dayDate?: string | null;
  year: number;
}

const RESERVED_CONTAINER_KEYS = new Set([
  'event',
  'events',
  'data',
  'days',
  'day',
  'dates',
  'date',
  'lineup',
  'lineups',
  'performances',
  'performance',
  'items',
  'acts',
  'act',
  'artists',
  'artist',
  'stages',
  'stage',
  'locations',
  'location',
  'venues',
  'venue',
  'schedule',
  'schedules',
  'timeslots',
  'times',
  'rows',
  'columns',
  'metadata',
  'meta',
  'settings',
  'options'
]);

const MONTHS: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11
};

export function buildClashfinderPublicKey(options?: { authParam?: string; authValidUntil?: string }) {
  const username = process.env.CLASHFINDER_AUTH_USERNAME;
  const privateKey = process.env.CLASHFINDER_PRIVATE_KEY;

  if (!username) throw new Error('Missing CLASHFINDER_AUTH_USERNAME');
  if (!privateKey) throw new Error('Missing CLASHFINDER_PRIVATE_KEY');

  const authParam = options?.authParam ?? '';
  const authValidUntil = options?.authValidUntil ?? '';
  const hashInput = `${username}${privateKey}${authParam}${authValidUntil}`;
  const publicKey = crypto.createHash('sha256').update(hashInput).digest('hex');

  return {
    username,
    publicKey,
    authParam,
    authValidUntil
  };
}

export function buildClashfinderEventUrl(slug: string) {
  const { username, publicKey } = buildClashfinderPublicKey();
  const cleanSlug = slug.trim().replace(/\.json$/i, '');
  const url = new URL(`https://clashfinder.com/data/event/${encodeURIComponent(cleanSlug)}.json`);
  url.searchParams.set('authUsername', username);
  url.searchParams.set('authPublicKey', publicKey);
  return url.toString();
}

export async function fetchClashfinderEvent(slug: string) {
  const response = await fetch(buildClashfinderEventUrl(slug), {
    headers: {
      accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Clashfinder returned ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function toStringValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return null;
}

function parseDateLike(value: unknown): Date | null {
  const raw = toStringValue(value);
  if (!raw) return null;

  const normalized = raw.includes('T') || raw.includes(' ') ? raw : raw.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isoOrNull(value: unknown): string | null {
  const parsed = parseDateLike(value);
  return parsed ? parsed.toISOString() : null;
}

function dayFromIso(iso: string) {
  return iso.slice(0, 10);
}

function inferYear(value: unknown, fallback = new Date().getUTCFullYear()) {
  const raw = toStringValue(value);
  const match = raw?.match(/20\d{2}/);
  return match ? Number(match[0]) : fallback;
}

function readField(source: Record<string, unknown>, names: string[]) {
  for (const name of names) {
    if (source[name] !== undefined && source[name] !== null && source[name] !== '') return source[name];
  }
  return null;
}

function looksLikeTime(value: string) {
  return /^\d{1,2}:\d{2}$/.test(value.trim()) || /^\d{1,2}(?:am|pm)$/i.test(value.trim());
}

function parseDateLabel(value: unknown, year: number): string | null {
  const raw = toStringValue(value)?.trim();
  if (!raw) return null;

  const iso = isoOrNull(raw);
  if (iso) return dayFromIso(iso);

  const clean = raw.replace(/\u200b/g, '').replace(/,/g, ' ');
  const match = clean.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)/i) || clean.match(/([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?/i);
  if (!match) return null;

  const first = match[1];
  const second = match[2];
  const day = /^\d+$/.test(first) ? Number(first) : Number(second);
  const monthName = /^\d+$/.test(first) ? second.toLowerCase() : first.toLowerCase();
  const month = MONTHS[monthName];

  if (!Number.isFinite(day) || month === undefined) return null;
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}

function combineDayAndTime(dayDate: string | null | undefined, time: unknown, year: number) {
  const raw = toStringValue(time)?.trim();
  if (!raw) return null;

  const directIso = isoOrNull(raw);
  if (directIso) return directIso;

  const day = dayDate || parseDateLabel(raw, year);
  if (!day) return null;

  let hour: number | null = null;
  let minute = 0;
  const ampm = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  const twentyFour = raw.match(/^(\d{1,2}):(\d{2})$/);

  if (ampm) {
    hour = Number(ampm[1]);
    minute = ampm[2] ? Number(ampm[2]) : 0;
    const suffix = ampm[3].toLowerCase();
    if (suffix === 'pm' && hour < 12) hour += 12;
    if (suffix === 'am' && hour === 12) hour = 0;
  } else if (twentyFour) {
    hour = Number(twentyFour[1]);
    minute = Number(twentyFour[2]);
  }

  if (hour === null || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`;
}

function normalizeStageName(value: unknown): string | null {
  const raw = toStringValue(value)?.trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (RESERVED_CONTAINER_KEYS.has(lower)) return null;
  if (looksLikeTime(raw)) return null;
  if (parseDateLabel(raw, new Date().getUTCFullYear())) return null;
  return raw;
}

function containsPerformanceLikeData(value: unknown, depth = 0): boolean {
  if (depth > 4 || value === null || value === undefined) return false;

  if (Array.isArray(value)) return value.some((item) => containsPerformanceLikeData(item, depth + 1));

  if (typeof value !== 'object') return false;

  const record = value as Record<string, unknown>;
  const hasArtist = readField(record, ['artist', 'artistName', 'act', 'actName', 'name', 'title', 'label']) !== null;
  const hasStart = readField(record, ['start', 'startTime', 'start_time', 'starts', 'timeStart', 'startDateTime', 'from']) !== null;
  const hasEnd = readField(record, ['end', 'endTime', 'end_time', 'ends', 'timeEnd', 'endDateTime', 'to']) !== null;

  if (hasArtist && (hasStart || hasEnd)) return true;

  return Object.values(record).some((child) => containsPerformanceLikeData(child, depth + 1));
}

function normalizePerformanceItem(item: unknown, context: ParseContext): NormalizedClashfinderPerformance | null {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;

  const record = item as Record<string, unknown>;
  const artistName =
    toStringValue(readField(record, ['artist', 'artistName', 'act', 'actName', 'name', 'title', 'label'])) ?? null;
  const explicitStage =
    toStringValue(readField(record, ['stage', 'stageName', 'venue', 'venueName'])) ?? null;
  const stageName = explicitStage || context.stageName || 'Unknown Stage';

  const startIso =
    isoOrNull(readField(record, ['start', 'startTime', 'start_time', 'starts', 'timeStart', 'startDateTime', 'from'])) ||
    combineDayAndTime(context.dayDate, readField(record, ['start', 'startTime', 'start_time', 'starts', 'timeStart', 'from']), context.year);
  const endIso =
    isoOrNull(readField(record, ['end', 'endTime', 'end_time', 'ends', 'timeEnd', 'endDateTime', 'to'])) ||
    combineDayAndTime(context.dayDate, readField(record, ['end', 'endTime', 'end_time', 'ends', 'timeEnd', 'to']), context.year);

  if (!artistName || !startIso || !endIso) return null;

  return {
    artistName,
    stageName,
    startTime: startIso,
    endTime: endIso,
    dayDate: context.dayDate ?? dayFromIso(startIso)
  };
}

function collectContextualPerformances(raw: unknown, context: ParseContext, depth = 0): NormalizedClashfinderPerformance[] {
  if (depth > 8 || raw === null || raw === undefined) return [];

  if (Array.isArray(raw)) {
    return raw.flatMap((item) => {
      const direct = normalizePerformanceItem(item, context);
      const nested = collectContextualPerformances(item, context, depth + 1);
      return direct ? [direct, ...nested] : nested;
    });
  }

  if (typeof raw !== 'object') return [];

  const record = raw as Record<string, unknown>;
  const direct = normalizePerformanceItem(record, context);
  const collected = direct ? [direct] : [];

  for (const [key, child] of Object.entries(record)) {
    const possibleDay = parseDateLabel(key, context.year);
    const possibleStage = normalizeStageName(key);
    const childHasPerformanceData = containsPerformanceLikeData(child);

    const nextContext: ParseContext = {
      ...context,
      dayDate: possibleDay || context.dayDate,
      stageName: possibleStage && childHasPerformanceData && !possibleDay ? possibleStage : context.stageName
    };

    collected.push(...collectContextualPerformances(child, nextContext, depth + 1));
  }

  return collected;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function getLocationEntries(locations: unknown): Array<{ key: string; value: unknown }> {
  if (Array.isArray(locations)) {
    return locations.map((value, index) => ({ key: String(index), value }));
  }

  const record = asRecord(locations);
  if (!record) return [];
  return Object.entries(record).map(([key, value]) => ({ key, value }));
}

function normalizeLocationsFormat(root: Record<string, unknown>, context: ParseContext): NormalizedClashfinderPerformance[] {
  const locations = root.locations;
  const entries = getLocationEntries(locations);
  const performances: NormalizedClashfinderPerformance[] = [];

  for (const entry of entries) {
    const locationRecord = asRecord(entry.value);
    const stageName =
      normalizeStageName(locationRecord ? readField(locationRecord, ['name', 'title', 'label', 'stage', 'stageName', 'venue']) : null) ||
      normalizeStageName(entry.key) ||
      'Unknown Stage';

    performances.push(
      ...collectContextualPerformances(entry.value, {
        ...context,
        stageName
      })
    );
  }

  return performances;
}

function normalizeNestedDayStageFormat(raw: unknown, context: ParseContext): NormalizedClashfinderPerformance[] {
  if (!Array.isArray(raw)) return [];

  const performances: NormalizedClashfinderPerformance[] = [];

  raw.forEach((dayEntry) => {
    if (!dayEntry || typeof dayEntry !== 'object' || Array.isArray(dayEntry)) return;
    const dayRecord = dayEntry as Record<string, unknown>;
    const dayDate = parseDateLabel(dayRecord.day_date ?? dayRecord.date, context.year) || toStringValue(dayRecord.day_date ?? dayRecord.date);
    const stageName = toStringValue(dayRecord.stage ?? dayRecord.stageName) ?? context.stageName ?? 'Unknown Stage';
    const dayPerformances = dayRecord.performances;

    if (!Array.isArray(dayPerformances)) return;

    dayPerformances.forEach((perf) => {
      const normalized = normalizePerformanceItem(perf, {
        ...context,
        dayDate: dayDate ?? context.dayDate,
        stageName
      });
      if (normalized) performances.push(normalized);
    });
  });

  return performances;
}

export function normalizeClashfinderEvent(raw: unknown, slug: string): NormalizedClashfinderEvent {
  const root = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const name =
    toStringValue(readField(root, ['name', 'title', 'eventName', 'festivalName'])) ??
    slug.replace(/[-_]+/g, ' ');
  const year = inferYear(name, inferYear(readField(root, ['year', 'startDate', 'start', 'start_date'])));
  const location = toStringValue(readField(root, ['location', 'venue', 'address'])) ?? null;

  const context: ParseContext = { year };
  const locationsPerformances = normalizeLocationsFormat(root, context);
  const nestedPerformances = normalizeNestedDayStageFormat(raw, context);
  const contextualPerformances = collectContextualPerformances(raw, context).filter(
    (performance) => performance.stageName !== 'locations'
  );

  const deduped = new Map<string, NormalizedClashfinderPerformance>();
  [...locationsPerformances, ...nestedPerformances, ...contextualPerformances].forEach((perf) => {
    const key = `${perf.stageName}|${perf.artistName}|${perf.startTime}`;
    deduped.set(key, perf);
  });

  const performances = Array.from(deduped.values()).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const firstStart = performances[0]?.dayDate ?? null;
  const lastStart = performances[performances.length - 1]?.dayDate ?? null;

  return {
    slug,
    name,
    year,
    location,
    startDate: toStringValue(readField(root, ['startDate', 'start_date'])) ?? firstStart,
    endDate: toStringValue(readField(root, ['endDate', 'end_date'])) ?? lastStart,
    performances,
    raw
  };
}
