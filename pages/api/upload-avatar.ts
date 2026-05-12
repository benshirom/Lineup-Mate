import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '8mb'
    }
  }
};

function signCloudinaryParams(params: Record<string, string | number>, apiSecret: string) {
  const signaturePayload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');

  return crypto.createHash('sha1').update(`${signaturePayload}${apiSecret}`).digest('hex');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return res.status(500).json({
      error: 'Cloudinary is not configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to Netlify environment variables.'
    });
  }

  const file = typeof req.body?.file === 'string' ? req.body.file : '';
  const userId = typeof req.body?.userId === 'string' ? req.body.userId : 'anonymous';

  if (!file.startsWith('data:image/')) {
    return res.status(400).json({ error: 'Upload an image file.' });
  }

  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = 'lineup-mate/avatars';
    const publicId = `user_${userId}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    const signedParams = { folder, public_id: publicId, overwrite: 'true', timestamp };
    const signature = signCloudinaryParams(signedParams, apiSecret);

    const body = new FormData();
    body.append('file', file);
    body.append('api_key', apiKey);
    body.append('timestamp', String(timestamp));
    body.append('folder', folder);
    body.append('public_id', publicId);
    body.append('overwrite', 'true');
    body.append('signature', signature);

    const uploadResponse = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body
    });

    const uploadData = await uploadResponse.json();
    if (!uploadResponse.ok) {
      return res.status(uploadResponse.status).json({ error: uploadData?.error?.message || 'Cloudinary upload failed.' });
    }

    return res.status(200).json({
      ok: true,
      secureUrl: uploadData.secure_url,
      publicId: uploadData.public_id
    });
  } catch (error: unknown) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown upload error.' });
  }
}
