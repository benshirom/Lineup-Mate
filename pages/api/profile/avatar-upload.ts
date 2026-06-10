import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import * as Sentry from '@sentry/nextjs';
import getSupabaseAdmin from '@/lib/supabaseAdmin';
import { applyRateLimit } from '@/lib/rateLimit';

// 6_400_000 ≈ base64 overhead for a ~4.7 MB raw image (4/3 ratio).
// Keep in sync with bodyParser.sizeLimit below.
const MAX_BASE64_LENGTH = 6_400_000;

const ALLOWED_MIME_TYPES = ['png', 'jpeg', 'jpg', 'webp', 'gif'];

/**
 * Verifies the actual file bytes match a known image magic number.
 * Guards against a mislabelled data URL (e.g. SVG with a PNG MIME prefix).
 */
function detectImageMagicBytes(buffer: Buffer): boolean {
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return true;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
  // WebP: RIFF....WEBP
  if (buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP') return true;
  // GIF: GIF87a or GIF89a
  const gifMagic = buffer.toString('ascii', 0, 6);
  if (gifMagic === 'GIF87a' || gifMagic === 'GIF89a') return true;
  return false;
}

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

  // Cloudinary's signed-upload API enforces SHA-1 for request signing (not our choice).
  return crypto.createHash('sha1').update(`${toSign}${apiSecret}`).digest('hex');
}

function isValidImageDataUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const mimePattern = new RegExp(`^data:image/(${ALLOWED_MIME_TYPES.join('|')});base64,`, 'i');
  return mimePattern.test(value) && value.length <= MAX_BASE64_LENGTH;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const allowed = await applyRateLimit(req, res, 'avatar-upload');
  if (!allowed) return;

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

    // Verify magic bytes server-side to prevent MIME type spoofing via the data URL prefix.
    const base64Data = file.replace(/^data:image\/[a-z]+;base64,/i, '');
    const fileBuffer = Buffer.from(base64Data, 'base64');
    if (!detectImageMagicBytes(fileBuffer)) {
      return res.status(400).json({ error: 'Upload a valid image file up to 4MB.' });
    }

    const { cloudName, apiKey, apiSecret } = cloudinaryEnv();
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = 'lineup-mate/avatars';
    const publicId = user.id;
    const uploadParams = {
      folder,
      public_id: publicId,
      overwrite: 'true',
      invalidate: 'true',
      timestamp
    };
    const signature = signCloudinaryParams(uploadParams, apiSecret);

    const body = new FormData();
    body.append('file', file); // send original data URL; Cloudinary accepts base64 data URLs
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
    Sentry.captureException(error, { extra: { action: 'avatar-upload' } });
    console.error('[Profile API Error] avatar-upload', error);
    return res.status(500).json({ error: 'Could not upload avatar.' });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '6mb'
    }
  }
};
