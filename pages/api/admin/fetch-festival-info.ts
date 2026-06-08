import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import { requireAdmin } from '@/lib/adminAuth';
import { applyRateLimit } from '@/lib/rateLimit';
import { z } from 'zod';

const RequestSchema = z.object({
  festivalName: z.string().trim().min(1).max(200),
});

interface ResponseData {
  description: string | null;
  error?: string;
}

async function fetchFromWikipedia(festivalName: string): Promise<string | null> {
  // Strip trailing year (e.g. "Ozora Festival 2026" → "Ozora Festival")
  const baseName = festivalName.replace(/\s+\d{4}$/, '').trim();

  const candidates = [
    baseName,
    `${baseName} (festival)`,
    festivalName,
  ];

  try {
    for (const candidate of candidates) {
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(candidate)}`;
      const res = await fetch(url, { headers: { 'User-Agent': 'lineup-mate/1.0' } });
      if (res.ok) {
        const data = await res.json() as { extract?: string; type?: string };
        if (data.type !== 'disambiguation' && data.extract) return data.extract;
      }
    }
  } catch (_) { /* ignore */ }
  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ description: null, error: 'Method not allowed.' });
  }

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ description: null, error: auth.error });
  }

  if (!await applyRateLimit(req, res, 'admin-fetch-festival')) return;

  const parsed = RequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ description: null, error: 'festivalName must be a non-empty string up to 200 characters.' });
  }
  const { festivalName } = parsed.data;

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (apiKey) {
    try {
      const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(festivalName + ' festival')}&key=${apiKey}`;
      const searchRes = await fetch(searchUrl);
      const searchData = await searchRes.json() as { results?: Array<{ place_id: string }> };

      const placeId = searchData.results?.[0]?.place_id;
      if (placeId) {
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=editorial_summary,name&key=${apiKey}`;
        const detailsRes = await fetch(detailsUrl);
        const detailsData = await detailsRes.json() as { result?: { editorial_summary?: { overview?: string } } };
        const description = detailsData.result?.editorial_summary?.overview ?? null;
        if (description) return res.status(200).json({ description });
      }
    } catch (err) {
      Sentry.captureException(err, { extra: { festivalName, action: 'fetch-festival-info-google' } });
      console.error('[fetch-festival-info] Google Places error:', err);
    }
  }

  // Wikipedia fallback (free, no key required)
  const description = await fetchFromWikipedia(festivalName);
  if (description) return res.status(200).json({ description });

  return res.status(200).json({ description: null, error: 'No description found. Try editing manually.' });
}
