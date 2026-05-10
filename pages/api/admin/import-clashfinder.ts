import type { NextApiRequest, NextApiResponse } from 'next';
import { fetchClashfinderEvent, normalizeClashfinderEvent } from '@/lib/clashfinder';
import { importNormalizedFestival } from '@/lib/importFestival';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const slug = typeof req.body?.slug === 'string' ? req.body.slug.trim() : '';
  if (!slug) {
    return res.status(400).json({ error: 'Missing Clashfinder slug.' });
  }

  try {
    const raw = await fetchClashfinderEvent(slug);
    const normalized = normalizeClashfinderEvent(raw, slug);

    if (normalized.performances.length === 0) {
      return res.status(422).json({
        error: 'Could not find performances in the Clashfinder response.',
        hint: 'The API response format may be different. Check the raw response from Clashfinder.'
      });
    }

    const result = await importNormalizedFestival(normalized);

    return res.status(200).json({
      ok: true,
      festival: {
        id: result.festivalId,
        name: normalized.name,
        year: normalized.year,
        startDate: normalized.startDate,
        endDate: normalized.endDate
      },
      imported: result.insertedPerformances,
      skipped: result.skippedPerformances
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown import error';
    return res.status(500).json({ error: message });
  }
}
