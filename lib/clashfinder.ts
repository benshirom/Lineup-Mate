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

function findArrayCandidates(value: unknown, depth = 0): unknown[][] {
  if (depth > 5 || !value || typeof value !== 'object') return [];

  if (Array.isArray(value)) {
    const nested = value.flatMap((item) => findArrayCandidates(item, depth + 1));
    return [value, ...nested];
  }

  return Object.values(value as Record<string, unknown>).flatMap((child) => findArrayCandidates(child, depth + 1));
}

function readField(source: Record<string, unknown>, names: string[]) {
  for (const name of names) {
    if (source[name] !== undefined && source[name] !== null && source[name] !== '') return source[name];
  }
  return null;
}

function normalizePerformanceItem(item: unknown): NormalizedClashfinderPerformance | null {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;

  const record = item as Record<string, unknown>;
  const artistName =
    toStringValue(readField(record, ['artist', 'artistName', 'act', 'actName', 'name', 'title', 'label'])) ?? null;
  const stageName =
    toStringValue(readField(record, ['stage', 'stageName', 'venue', 'venueName', 'location'])) ?? 'Unknown Stage';
  const startIso = isoOrNull(readField(record, ['start', 'startTime', 'start_time', 'starts', 'timeStart', 'startDateTime']));
  const endIso = isoOrNull(readField(record, ['end', 'endTime', 'end_time', 'ends', 'timeEnd', 'endDateTime']));

  if (!artistName || !startIso || !endIso) return null;

  return {
    artistName,
    stageName,
    startTime: startIso,
    endTime: endIso,
    dayDate: dayFromIso(startIso)
  };
}

function normalizeNestedDayStageFormat(raw: unknown): NormalizedClashfinderPerformance[] {
  if (!Array.isArray(raw)) return [];

  const performances: NormalizedClashfinderPerformance[] = [];

  raw.forEach((dayEntry) => {
    if (!dayEntry || typeof dayEntry !== 'object' || Array.isArray(dayEntry)) return;
    const dayRecord = dayEntry as Record<string, unknown>;
    const dayDate = toStringValue(dayRecord.day_date ?? dayRecord.date);
    const stageName = toStringValue(dayRecord.stage ?? dayRecord.stageName) ?? 'Unknown Stage';
    const dayPerformances = dayRecord.performances;

    if (!Array.isArray(dayPerformances)) return;

    dayPerformances.forEach((perf) => {
      if (!perf || typeof perf !== 'object' || Array.isArray(perf)) return;
      const perfRecord = perf as Record<string, unknown>;
      const artistName = toStringValue(perfRecord.artist ?? perfRecord.name ?? perfRecord.title);
      const startIso = isoOrNull(perfRecord.start ?? perfRecord.startTime ?? perfRecord.start_time);
      const endIso = isoOrNull(perfRecord.end ?? perfRecord.endTime ?? perfRecord.end_time);

      if (!artistName || !startIso || !endIso) return;

      performances.push({
        artistName,
        stageName,
        startTime: startIso,
        endTime: endIso,
        dayDate: dayDate ?? dayFromIso(startIso)
      });
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

  const nestedPerformances = normalizeNestedDayStageFormat(raw);
  const genericPerformances = findArrayCandidates(raw)
    .flatMap((candidate) => candidate.map(normalizePerformanceItem).filter(Boolean) as NormalizedClashfinderPerformance[]);

  const deduped = new Map<string, NormalizedClashfinderPerformance>();
  [...nestedPerformances, ...genericPerformances].forEach((perf) => {
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
