import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import { fetchClashfinderEvent, normalizeClashfinderEvent } from '@/lib/clashfinder';
import { cleanupClashfinderPerformances, getStageNames } from '@/lib/clashfinderCleanup';
import { importNormalizedFestival } from '@/lib/importFestival';
import { requireAdmin } from '@/lib/adminAuth';
import { applyRateLimit } from '@/lib/rateLimit';
import { z } from 'zod';

const bodySchema = z.object({
  slug: z.string().trim().min(1, 'Missing Clashfinder slug.').max(200),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const admin = await requireAdmin(req);
  if (!admin.ok) {
    return res.status(admin.status).json({ error: admin.error });
  }

  const allowed = await applyRateLimit(req, res, 'admin-clashfinder-import');
  if (!allowed) return;

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input.' });
  }
  const { slug } = parsed.data;

  try {
    const raw = await fetchClashfinderEvent(slug);
    const normalized = normalizeClashfinderEvent(raw, slug);
    const cleanedPerformances = cleanupClashfinderPerformances(normalized.performances);
    const detectedStages = getStageNames(cleanedPerformances);
    const detectedDays = Array.from(new Set(cleanedPerformances.map((performance) => performance.dayDate))).sort();

    if (cleanedPerformances.length === 0) {
      return res.status(422).json({
        error: 'Could not find performances in the Clashfinder response.',
        hint: 'The API response format may be different. Check the raw response from Clashfinder.'
      });
    }

    const result = await importNormalizedFestival({
      ...normalized,
      performances: cleanedPerformances
    });

    return res.status(200).json({
      ok: true,
      festival: {
        id: result.festivalId,
        slug: normalized.slug,
        name: normalized.name,
        year: normalized.year,
        startDate: normalized.startDate,
        endDate: normalized.endDate
      },
      detectedPerformances: cleanedPerformances.length,
      detectedStages: detectedStages.length,
      detectedDays: detectedDays.length,
      sampleStages: detectedStages.slice(0, 20),
      sampleDays: detectedDays.slice(0, 20),
      imported: result.insertedPerformances,
      skipped: result.skippedPerformances,
      deactivated: result.deactivatedPerformances
    });
  } catch (error: unknown) {
    Sentry.captureException(error, { extra: { slug, action: 'import-clashfinder' } });
    console.error('[Admin API Error] import-clashfinder', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
