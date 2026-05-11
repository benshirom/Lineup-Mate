import getSupabaseAdmin from './supabaseAdmin';
import { buildClashfinderEventUrl } from './clashfinder';
import type { NormalizedClashfinderEvent, NormalizedClashfinderPerformance } from './clashfinder';
import { cleanupClashfinderPerformances } from './clashfinderCleanup';

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

async function upsertArtist(name: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from('artists')
    .upsert({ name }, { onConflict: 'name' })
    .select('id')
    .single();

  if (error) throw error;
  return data.id as number;
}

async function upsertStage(festivalId: number, name: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from('stages')
    .upsert({ festival_id: festivalId, name }, { onConflict: 'festival_id,name' })
    .select('id')
    .single();

  if (error) throw error;
  return data.id as number;
}

async function upsertPerformance(
  festivalId: number,
  performance: NormalizedClashfinderPerformance,
  sourceLastSeenAt: string
): Promise<ImportedPerformanceIdentity> {
  const supabaseAdmin = getSupabaseAdmin();
  const [artistId, stageId] = await Promise.all([
    upsertArtist(performance.artistName),
    upsertStage(festivalId, performance.stageName)
  ]);

  const { error } = await supabaseAdmin.from('performances').upsert(
    {
      festival_id: festivalId,
      stage_id: stageId,
      artist_id: artistId,
      start_time: performance.startTime,
      end_time: performance.endTime,
      day_date: performance.dayDate,
      is_active: true,
      source_last_seen_at: sourceLastSeenAt
    },
    { onConflict: 'festival_id,stage_id,artist_id,start_time' }
  );

  if (error) throw error;

  return {
    stageId,
    artistId,
    startTime: performance.startTime
  };
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
    .filter((performance: any) => {
      const key = `${performance.stage_id}|${performance.artist_id}|${performance.start_time}`;
      return !seenKeys.has(key);
    })
    .map((performance: any) => performance.id);

  if (idsToDeactivate.length === 0) return 0;

  const { error: updateError } = await supabaseAdmin
    .from('performances')
    .update({ is_active: false, source_last_seen_at: sourceLastSeenAt })
    .in('id', idsToDeactivate);

  if (updateError) throw updateError;

  return idsToDeactivate.length;
}

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
    raw_clashfinder: event.raw
  };

  const { data: festival, error: festivalError } = existingBySlug?.id
    ? await supabaseAdmin.from('festivals').update(payload).eq('id', existingBySlug.id).select('id').single()
    : await supabaseAdmin.from('festivals').upsert(payload, { onConflict: 'name,year' }).select('id').single();

  if (festivalError) throw festivalError;

  let insertedPerformances = 0;
  let skippedPerformances = 0;
  const seenPerformances: ImportedPerformanceIdentity[] = [];

  for (const performance of performances) {
    try {
      const seenPerformance = await upsertPerformance(festival.id, performance, sourceLastSeenAt);
      seenPerformances.push(seenPerformance);
      insertedPerformances += 1;
    } catch (error) {
      skippedPerformances += 1;
      console.error('Failed to import performance', performance, error);
    }
  }

  const deactivatedPerformances = await deactivateMissingPerformances(
    festival.id,
    seenPerformances,
    sourceLastSeenAt
  );

  return {
    festivalId: festival.id,
    insertedPerformances,
    skippedPerformances,
    deactivatedPerformances
  };
}
