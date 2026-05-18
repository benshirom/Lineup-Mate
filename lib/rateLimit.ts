import type { NextApiRequest, NextApiResponse } from 'next';

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();


function isRateLimitEnabled() {
  if (process.env.DISABLE_API_RATE_LIMIT === 'true') return false;
  if (process.env.CI === 'true') return false;
  if (process.env.NODE_ENV === 'test') return false;
  return true;
}

function cleanup(now: number) {
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function getRequestIp(req: NextApiRequest): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    return xff.split(',')[0].trim();
  }
  if (Array.isArray(xff) && xff.length > 0 && xff[0].trim()) {
    return xff[0].split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

export function applyRateLimit(options: {
  req: NextApiRequest;
  res: NextApiResponse;
  key: string;
  limit: number;
  windowMs: number;
}): { ok: true } | { ok: false } {
  const { req, res, key, limit, windowMs } = options;
  if (!isRateLimitEnabled()) {
    return { ok: true };
  }
  const now = Date.now();
  cleanup(now);

  const ip = getRequestIp(req);
  const bucketKey = `${key}:${ip}`;
  const existing = buckets.get(bucketKey);

  if (!existing || existing.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (existing.count >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    res.setHeader('Retry-After', String(retryAfterSeconds));
    res.status(429).json({ error: 'Too many requests. Please try again later.' });
    return { ok: false };
  }

  existing.count += 1;
  buckets.set(bucketKey, existing);
  return { ok: true };
}
