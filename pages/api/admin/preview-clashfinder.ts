import type { NextApiRequest, NextApiResponse } from 'next';
import { fetchClashfinderEvent, normalizeClashfinderEvent } from '@/lib/clashfinder';
import { cleanupClashfinderPerformances, getStageNames } from '@/lib/clashfinderCleanup';
import type { NormalizedClashfinderPerformance } from '@/lib/clashfinder';
import { requireAdmin } from '@/lib/adminAuth';
import { z } from 'zod';

const bodySchema = z.object({
  slug: z.string().trim().min(1, 'Missing Clashfinder slug.').max(200),
});

function summarizeRawShape(raw: unknown) {
  if (Array.isArray(raw)) {
    return {
      type: 'array',
      length: raw.length,
      sampleKeys: raw[0] && typeof raw[0] === 'object' && !Array.isArray(raw[0]) ? Object.keys(raw[0]).slice(0, 20) : []
    };
  }

  if (raw && typeof raw === 'object') {
    return {
      type: 'object',
      keys: Object.keys(raw as Record<string, unknown>).slice(0, 40)
    };
  }

  return { type: typeof raw };
}

function getDayNames(performances: NormalizedClashfinderPerformance[]) {
  return Array.from(new Set(performances.map((performance) => performance.dayDate))).sort();
}

function getRepresentativeSample(performances: NormalizedClashfinderPerformance[], limit = 18) {
  const sample = new Map<string, NormalizedClashfinderPerformance>();
  const sorted = [...performances].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const days = getDayNames(sorted);
  const stages = getStageNames(sorted);

  for (const day of days) {
    const firstForDay = sorted.find((performance) => performance.dayDate === day);
    if (firstForDay) sample.set(`${firstForDay.stageName}|${firstForDay.artistName}|${firstForDay.startTime}`, firstForDay);
  }

  for (const stage of stages) {
    const firstForStage = sorted.find((performance) => performance.stageName === stage);
    if (firstForStage) sample.set(`${firstForStage.stageName}|${firstForStage.artistName}|${firstForStage.startTime}`, firstForStage);
  }

  for (const performance of sorted) {
    if (sample.size >= limit) break;
    sample.set(`${performance.stageName}|${performance.artistName}|${performance.startTime}`, performance);
  }

  return Array.from(sample.values()).sort((a, b) => a.startTime.localeCompare(b.startTime)).slice(0, limit);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const admin = await requireAdmin(req);
  if (!admin.ok) {
    return res.status(admin.status).json({ error: admin.error });
  }

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input.' });
  }
  const { slug } = parsed.data;

  try {
    const raw = await fetchClashfinderEvent(slug);
    const normalized = normalizeClashfinderEvent(raw, slug);
    const performances = cleanupClashfinderPerformances(normalized.performances);
    const detectedStages = getStageNames(performances);
    const detectedDays = getDayNames(performances);

    return res.status(200).json({
      ok: true,
      festival: {
        slug: normalized.slug,
        name: normalized.name,
        year: normalized.year,
        location: normalized.location,
        startDate: normalized.startDate,
        endDate: normalized.endDate
      },
      detectedPerformances: performances.length,
      detectedStages: detectedStages.length,
      detectedDays: detectedDays.length,
      sampleStages: detectedStages.slice(0, 20),
      sampleDays: detectedDays.slice(0, 20),
      samplePerformances: getRepresentativeSample(performances),
      rawShape: summarizeRawShape(raw),
      warning:
        performances.length === 0
          ? 'No performances were detected. The Clashfinder response may use a format that needs a custom parser.'
          : detectedStages.some((stage) => stage.toLowerCase() === 'locations')
            ? 'Parser warning: detected a stage named "locations", which usually means the Clashfinder locations container was parsed incorrectly.'
            : null
    });
  } catch (error: unknown) {
    console.error('[Admin API Error] preview-clashfinder', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
