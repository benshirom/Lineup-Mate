import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import getSupabaseAdmin from '@/lib/supabaseAdmin';

const MAX_BASE64_LENGTH = 6_000_000;

function cloudinaryEnv() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Missing Cloudinary environment variables.');
  }

  return { cloudName, apiKey, apiSecret };
}

function signCloudinaryParams(params: Record<string, string | number>, apiSecret: string) {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');

  return crypto.createHash('sha1').update(`${toSign}${apiSecret}`).digest('hex');
}

function isValidImageDataUrl(value: unknown): value is string {
  return typeof value === 'string' && /^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(value) && value.length <= MAX_BASE64_LENGTH;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice('Bearer '.length)
    : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token.' });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const {
      data: { user },
      error: userError
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid authorization token.' });
    }

    const { file } = req.body || {};
    if (!isValidImageDataUrl(file)) {
      return res.status(400).json({ error: 'Upload a valid image file up to 4MB.' });
    }

    const { cloudName, apiKey, apiSecret } = cloudinaryEnv();
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = 'lineup-mate/avatars';
    const publicId = `${folder}/${user.id}`;
    const uploadParams = {
      folder,
      public_id: publicId,
      overwrite: 'true',
      invalidate: 'true',
      timestamp
    };
    const signature = signCloudinaryParams(uploadParams, apiSecret);

    const body = new FormData();
    body.append('file', file);
    body.append('api_key', apiKey);
    body.append('timestamp', String(timestamp));
    body.append('folder', folder);
    body.append('public_id', publicId);
    body.append('overwrite', 'true');
    body.append('invalidate', 'true');
    body.append('signature', signature);

    const uploadResponse = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body
    });

    const payload = await uploadResponse.json().catch(() => ({}));
    if (!uploadResponse.ok) {
      return res.status(uploadResponse.status).json({ error: payload.error?.message || 'Cloudinary upload failed.' });
    }

    if (!payload.secure_url) {
      return res.status(502).json({ error: 'Cloudinary did not return secure_url.' });
    }

    return res.status(200).json({
      ok: true,
      secure_url: payload.secure_url,
      public_id: payload.public_id
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Could not upload avatar.';
    return res.status(500).json({ error: message });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '6mb'
    }
  }
};
