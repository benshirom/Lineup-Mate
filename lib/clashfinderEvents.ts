import { buildClashfinderPublicKey } from './clashfinder';

export interface NormalizedClashfinderListItem {
  slug: string;
  name: string;
  year: number | null;
  url: string | null;
  isCore?: boolean | null;
}

function toStringValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return null;
}

function readField(source: Record<string, unknown>, names: string[]) {
  for (const name of names) {
    if (source[name] !== undefined && source[name] !== null && source[name] !== '') return source[name];
  }
  return null;
}

function inferYear(value: unknown): number | null {
  const raw = toStringValue(value);
  const match = raw?.match(/20\d{2}/);
  return match ? Number(match[0]) : null;
}

function slugFromValue(value: unknown): string | null {
  const raw = toStringValue(value)?.trim();
  if (!raw) return null;

  const eventDataMatch = raw.match(/\/data\/event\/([^/?#.]+)\.json/i);
  if (eventDataMatch) return eventDataMatch[1];

  const eventPageMatch = raw.match(/\/(?:s|m)\/([^/?#]+)/i);
  if (eventPageMatch) return eventPageMatch[1];

  if (/^[a-z0-9][a-z0-9_-]{1,80}$/i.test(raw) && !raw.includes('http')) return raw;
  return null;
}

export function buildClashfinderEventsListUrl(scope: 'core' | 'all' = 'all') {
  const { username, publicKey } = buildClashfinderPublicKey();
  const fileName = scope === 'core' ? 'events' : 'all';
  const url = new URL(`https://clashfinder.com/data/events/${fileName}.json`);
  url.searchParams.set('authUsername', username);
  url.searchParams.set('authPublicKey', publicKey);
  return url.toString();
}

export async function fetchClashfinderEventsList(scope: 'core' | 'all' = 'all') {
  const response = await fetch(buildClashfinderEventsListUrl(scope), {
    headers: { accept: 'application/json' }
  });

  if (!response.ok) {
    throw new Error(`Clashfinder events list returned ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function collectEventListItems(raw: unknown, parentKey?: string, depth = 0): NormalizedClashfinderListItem[] {
  if (depth > 7 || raw === null || raw === undefined) return [];

  if (Array.isArray(raw)) {
    return raw.flatMap((item) => collectEventListItems(item, undefined, depth + 1));
  }

  if (typeof raw !== 'object') return [];

  const record = raw as Record<string, unknown>;
  const name = toStringValue(readField(record, ['name', 'title', 'eventName', 'festivalName', 'label'])) ?? null;
  const url = toStringValue(readField(record, ['url', 'link', 'href', 'path'])) ?? null;
  const slug =
    slugFromValue(readField(record, ['slug', 'id', 'shortName', 'shortname', 'code'])) ||
    slugFromValue(url) ||
    slugFromValue(parentKey);

  const items: NormalizedClashfinderListItem[] = [];
  if (slug && name) {
    items.push({
      slug,
      name,
      year: inferYear(name) || inferYear(readField(record, ['year', 'start', 'startDate', 'date'])),
      url,
      isCore: typeof record.core === 'boolean' ? record.core : null
    });
  }

  for (const [key, child] of Object.entries(record)) {
    items.push(...collectEventListItems(child, key, depth + 1));
  }

  return items;
}

export function normalizeClashfinderEventsList(raw: unknown): NormalizedClashfinderListItem[] {
  const deduped = new Map<string, NormalizedClashfinderListItem>();

  collectEventListItems(raw).forEach((item) => {
    const existing = deduped.get(item.slug);
    if (!existing || item.name.length > existing.name.length) {
      deduped.set(item.slug, item);
    }
  });

  return Array.from(deduped.values()).sort((a, b) => {
    const ay = a.year ?? 0;
    const by = b.year ?? 0;
    if (ay !== by) return by - ay;
    return a.name.localeCompare(b.name);
  });
}
