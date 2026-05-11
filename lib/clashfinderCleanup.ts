import type { NormalizedClashfinderPerformance } from './clashfinder';

const BAD_STAGE_NAMES = new Set(['locations', 'location', 'unknown stage', 'unknown']);

function cleanStageName(stageName: string) {
  return stageName.trim().toLowerCase();
}

function realStageIdentity(performance: NormalizedClashfinderPerformance) {
  return `${performance.artistName}|${performance.startTime}|${performance.endTime}`;
}

function exactIdentity(performance: NormalizedClashfinderPerformance) {
  return `${performance.stageName}|${performance.artistName}|${performance.startTime}|${performance.endTime}`;
}

export function isBadStageName(stageName: string) {
  return BAD_STAGE_NAMES.has(cleanStageName(stageName));
}

export function cleanupClashfinderPerformances(
  performances: NormalizedClashfinderPerformance[]
): NormalizedClashfinderPerformance[] {
  const realStageKeys = new Set(
    performances
      .filter((performance) => !isBadStageName(performance.stageName))
      .map(realStageIdentity)
  );

  const deduped = new Map<string, NormalizedClashfinderPerformance>();

  for (const performance of performances) {
    const hasRealStageDuplicate = isBadStageName(performance.stageName) && realStageKeys.has(realStageIdentity(performance));
    if (hasRealStageDuplicate) continue;

    if (isBadStageName(performance.stageName)) continue;

    deduped.set(exactIdentity(performance), performance);
  }

  return Array.from(deduped.values()).sort((a, b) => a.startTime.localeCompare(b.startTime));
}

export function getStageNames(performances: NormalizedClashfinderPerformance[]) {
  return Array.from(new Set(performances.map((performance) => performance.stageName))).sort();
}
