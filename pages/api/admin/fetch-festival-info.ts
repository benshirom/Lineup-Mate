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
  if (!apiKey) {
    return res.status(200).json({ description: null, error: 'No Google Places API key configured. Set GOOGLE_PLACES_API_KEY in environment variables.' });
  }

  try {
    // Step 1: Text Search to find the place
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(festivalName + ' festival')}&key=${apiKey}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json() as { results?: Array<{ place_id: string }> };

    const placeId = searchData.results?.[0]?.place_id;
    if (!placeId) {
      return res.status(200).json({ description: null, error: 'No results found on Google Places.' });
    }

    // Step 2: Place Details for editorial_summary
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=editorial_summary,name&key=${apiKey}`;
    const detailsRes = await fetch(detailsUrl);
    const detailsData = await detailsRes.json() as { result?: { editorial_summary?: { overview?: string }; name?: string } };

    const description = detailsData.result?.editorial_summary?.overview ?? null;
    return res.status(200).json({ description });
  } catch (err) {
    console.error('[fetch-festival-info]', err);
    return res.status(500).json({ description: null, error: 'Failed to fetch from Google Places.' });
  }
}
