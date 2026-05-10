import supabaseAdmin from './supabaseAdmin';
import type { NormalizedClashfinderEvent, NormalizedClashfinderPerformance } from './clashfinder';

export interface ImportFestivalResult {
  festivalId: number;
  insertedPerformances: number;
  skippedPerformances: number;
}

async function upsertArtist(name: string) {
  const { data, error } = await supabaseAdmin
    .from('artists')
    .upsert({ name }, { onConflict: 'name' })
    .select('id')
    .single();

  if (error) throw error;
  return data.id as number;
}

async function upsertStage(festivalId: number, name: string) {
  const { data, error } = await supabaseAdmin
    .from('stages')
    .upsert({ festival_id: festivalId, name }, { onConflict: 'festival_id,name' })
    .select('id')
    .single();

  if (error) throw error;
  return data.id as number;
}

async function upsertPerformance(festivalId: number, performance: NormalizedClashfinderPerformance) {
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
      day_date: performance.dayDate
    },
    { onConflict: 'festival_id,stage_id,artist_id,start_time' }
  );

  if (error) throw error;
}

export async function importNormalizedFestival(event: NormalizedClashfinderEvent): Promise<ImportFestivalResult> {
  const { data: festival, error: festivalError } = await supabaseAdmin
    .from('festivals')
    .upsert(
      {
        name: event.name,
        year: event.year,
        location: event.location,
        start_date: event.startDate,
        end_date: event.endDate
      },
      { onConflict: 'name,year' }
    )
    .select('id')
    .single();

  if (festivalError) throw festivalError;

  let insertedPerformances = 0;
  let skippedPerformances = 0;

  for (const performance of event.performances) {
    try {
      await upsertPerformance(festival.id, performance);
      insertedPerformances += 1;
    } catch (error) {
      skippedPerformances += 1;
      console.error('Failed to import performance', performance, error);
    }
  }

  return {
    festivalId: festival.id,
    insertedPerformances,
    skippedPerformances
  };
}
