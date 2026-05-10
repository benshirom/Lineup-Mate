import type { NextApiRequest, NextApiResponse } from 'next';
import { fetchClashfinderEvent, normalizeClashfinderEvent } from '@/lib/clashfinder';

function isAuthorized(req: NextApiRequest) {
  const expectedSecret = process.env.ADMIN_IMPORT_SECRET;
  if (!expectedSecret) return false;

  const providedSecret = req.headers['x-admin-secret'];
  return typeof providedSecret === 'string' && providedSecret === expectedSecret;
}

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const slug = typeof req.body?.slug === 'string' ? req.body.slug.trim() : '';
  if (!slug) {
    return res.status(400).json({ error: 'Missing Clashfinder slug.' });
  }

  try {
    const raw = await fetchClashfinderEvent(slug);
    const normalized = normalizeClashfinderEvent(raw, slug);

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
      detectedPerformances: normalized.performances.length,
      samplePerformances: normalized.performances.slice(0, 10),
      rawShape: summarizeRawShape(raw),
      warning:
        normalized.performances.length === 0
          ? 'No performances were detected. The Clashfinder response may use a format that needs a custom parser.'
          : null
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown preview error';
    return res.status(500).json({ error: message });
  }
}
