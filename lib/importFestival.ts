import getSupabaseAdmin from './supabaseAdmin';
import { buildClashfinderEventUrl } from './clashfinder';
import type { NormalizedClashfinderEvent, NormalizedClashfinderPerformance } from './clashfinder';
import { cleanupClashfinderPerformances } from './clashfinderCleanup';
import type { Json } from '@/types/database.types';

export interface ImportFestivalResult {
  festivalId: number;
  insertedPerformances: number;
  skippedPerformances: number;
  deactivatedPerformances: number;
}

interface ImportedPerformanceIdentity {
  stageId: number;
  artistId: number;
  startTime: string;
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function chunkArray<T>(items: T[], size = 500): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function upsertArtists(names: string[]) {
  const supabaseAdmin = getSupabaseAdmin();
  const cleanNames = unique(names);
  const artistMap = new Map<string, number>();

  if (cleanNames.length === 0) return artistMap;

  const { error: upsertError } = await supabaseAdmin
    .from('artists')
    .upsert(cleanNames.map((name) => ({ name })), { onConflict: 'name', ignoreDuplicates: false });

  if (upsertError) throw upsertError;

  for (const namesChunk of chunkArray(cleanNames, 500)) {
    const { data, error } = await supabaseAdmin
      .from('artists')
      .select('id,name')
      .in('name', namesChunk);

    if (error) throw error;
    data?.forEach((artist) => artistMap.set(artist.name, artist.id));
  }

  return artistMap;
}

async function upsertStages(festivalId: number, names: string[]) {
  const supabaseAdmin = getSupabaseAdmin();
  const cleanNames = unique(names);
  const stageMap = new Map<string, number>();

  if (cleanNames.length === 0) return stageMap;

  const { error: upsertError } = await supabaseAdmin
    .from('stages')
    .upsert(
      cleanNames.map((name) => ({ festival_id: festivalId, name })),
      { onConflict: 'festival_id,name', ignoreDuplicates: false }
    );

  if (upsertError) throw upsertError;

  const { data, error } = await supabaseAdmin
    .from('stages')
    .select('id,name')
    .eq('festival_id', festivalId)
    .in('name', cleanNames);

  if (error) throw error;
  data?.forEach((stage) => stageMap.set(stage.name, stage.id));

  return stageMap;
}

async function deactivateMissingPerformances(
  festivalId: number,
  seenPerformances: ImportedPerformanceIdentity[],
  sourceLastSeenAt: string
) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: existingPerformances, error: existingError } = await supabaseAdmin
    .from('performances')
    .select('id, stage_id, artist_id, start_time')
    .eq('festival_id', festivalId)
    .eq('is_active', true);

  if (existingError) throw existingError;

  const seenKeys = new Set(
    seenPerformances.map((performance) => `${performance.stageId}|${performance.artistId}|${performance.startTime}`)
  );

  const idsToDeactivate = (existingPerformances ?? [])
    .filter((performance) => {
      const key = `${performance.stage_id}|${performance.artist_id}|${new Date(performance.start_time).toISOString()}`;
      return !seenKeys.has(key);
    })
    .map((performance) => performance.id);

  if (idsToDeactivate.length === 0) return 0;

  const { error: updateError } = await supabaseAdmin
    .from('performances')
    .update({ is_active: false, source_last_seen_at: sourceLastSeenAt })
    .in('id', idsToDeactivate);

  if (updateError) throw updateError;

  return idsToDeactivate.length;
}

function buildPerformanceRows(
  festivalId: number,
  performances: NormalizedClashfinderPerformance[],
  artistMap: Map<string, number>,
  stageMap: Map<string, number>,
  sourceLastSeenAt: string
) {
  const seenRows: ImportedPerformanceIdentity[] = [];
  const rows: Array<{
    festival_id: number;
    stage_id: number;
    artist_id: number;
    start_time: string;
    end_time: string;
    day_date: string;
    is_active: boolean;
    source_last_seen_at: string;
    source_external_id: string;
  }> = [];

  for (const performance of performances) {
    const artistId = artistMap.get(performance.artistName);
    const stageId = stageMap.get(performance.stageName);
    if (!artistId || !stageId) continue;

    const startTime = new Date(performance.startTime).toISOString();
    const endTime = new Date(performance.endTime).toISOString();

    rows.push({
      festival_id: festivalId,
      stage_id: stageId,
      artist_id: artistId,
      start_time: startTime,
      end_time: endTime,
      day_date: performance.dayDate,
      is_active: true,
      source_last_seen_at: sourceLastSeenAt,
      source_external_id: `${festivalId}:${stageId}:${artistId}:${startTime}`
    });

    seenRows.push({ stageId, artistId, startTime });
  }

  return { rows, seenRows };
}

// All steps use upsert (idempotent): re-running the import after a partial failure
// will complete the operation without data corruption.
export async function importNormalizedFestival(event: NormalizedClashfinderEvent): Promise<ImportFestivalResult> {
  const supabaseAdmin = getSupabaseAdmin();
  const sourceLastSeenAt = new Date().toISOString();
  const performances = cleanupClashfinderPerformances(event.performances);
  const { data: existingBySlug } = event.slug
    ? await supabaseAdmin.from('festivals').select('id').eq('clashfinder_slug', event.slug).maybeSingle()
    : ({ data: null } as { data: null });

  const payload = {
    name: event.name,
    year: event.year,
    location: event.location,
    start_date: event.startDate,
    end_date: event.endDate,
    clashfinder_slug: event.slug,
    source_url: buildClashfinderEventUrl(event.slug),
    source_type: 'clashfinder',
    last_synced_at: sourceLastSeenAt,
    raw_clashfinder: event.raw as Json
  };

  const { data: festival, error: festivalError } = existingBySlug?.id
    ? await supabaseAdmin.from('festivals').update(payload).eq('id', existingBySlug.id).select('id').single()
    : await supabaseAdmin.from('festivals').upsert(payload, { onConflict: 'name,year' }).select('id').single();

  if (festivalError) {
    throw Object.assign(festivalError, { importStep: 'upsert_festival' });
  }

  const [artistMap, stageMap] = await Promise.all([
    upsertArtists(performances.map((performance) => performance.artistName)).catch((e) => {
      throw Object.assign(e, { importStep: 'upsert_artists' });
    }),
    upsertStages(festival.id, performances.map((performance) => performance.stageName)).catch((e) => {
      throw Object.assign(e, { importStep: 'upsert_stages' });
    }),
  ]);

  const { rows, seenRows } = buildPerformanceRows(
    festival.id,
    performances,
    artistMap,
    stageMap,
    sourceLastSeenAt
  );

  let insertedPerformances = 0;
  const skippedPerformances = performances.length - rows.length;

  for (const rowsChunk of chunkArray(rows, 500)) {
    const { error } = await supabaseAdmin
      .from('performances')
      .upsert(rowsChunk, { onConflict: 'festival_id,stage_id,artist_id,start_time' });

    if (error) throw Object.assign(error, { importStep: 'upsert_performances' });
    insertedPerformances += rowsChunk.length;
  }

  const deactivatedPerformances = await deactivateMissingPerformances(
    festival.id,
    seenRows,
    sourceLastSeenAt
  ).catch((e) => {
    throw Object.assign(e, { importStep: 'deactivate_missing_performances' });
  });

  return {
    festivalId: festival.id,
    insertedPerformances,
    skippedPerformances,
    deactivatedPerformances
  };
}
