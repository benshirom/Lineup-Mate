import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/adminAuth';

interface RequestBody {
  festivalId?: number;
  festivalName?: string;
}

interface ResponseData {
  description: string | null;
  error?: string;
}

async function fetchFromWikipedia(festivalName: string): Promise<string | null> {
  try {
    // Search Wikipedia for the festival
    const searchUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(festivalName)}`;
    const res = await fetch(searchUrl, { headers: { 'User-Agent': 'lineup-mate/1.0' } });
    if (res.ok) {
      const data = await res.json() as { extract?: string; type?: string };
      if (data.type !== 'disambiguation' && data.extract) return data.extract;
    }
    // Fallback: try with "festival" appended
    const res2 = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(festivalName + ' (festival)')}`,
      { headers: { 'User-Agent': 'lineup-mate/1.0' } }
    );
    if (res2.ok) {
      const data2 = await res2.json() as { extract?: string; type?: string };
      if (data2.type !== 'disambiguation' && data2.extract) return data2.extract;
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

  const { festivalName } = req.body as RequestBody;
  if (!festivalName) {
    return res.status(400).json({ description: null, error: 'festivalName is required.' });
  }

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
      console.error('[fetch-festival-info] Google Places error:', err);
    }
  }

  // Wikipedia fallback (free, no key required)
  const description = await fetchFromWikipedia(festivalName);
  if (description) return res.status(200).json({ description });

  return res.status(200).json({ description: null, error: 'No description found. Try editing manually.' });
}
