import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import type { NextApiRequest, NextApiResponse } from 'next';

let ratelimit: Ratelimit | null = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, '1 m'),
    analytics: false,
  });
} else if (process.env.NODE_ENV === 'production') {
  // In production, missing Upstash config is a security misconfiguration — log clearly.
  console.error('[SECURITY] Rate limiting is DISABLED — UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not configured. All endpoints are unprotected against abuse.');
} else {
  console.warn('[rateLimit] Upstash not configured — rate limiting skipped (dev/test mode).');
}

export async function applyRateLimit(
  req: NextApiRequest,
  res: NextApiResponse,
  identifier?: string
): Promise<boolean> {
  if (!ratelimit) return true; // pass-through when not configured

  // Prefer the platform-verified IP (Netlify sets this, cannot be spoofed by clients).
  // Fall back to the first X-Forwarded-For entry only when platform header is absent.
  const ip =
    (req.headers['x-nf-client-connection-ip'] as string) ||
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'anonymous';

  const key = identifier ? `${identifier}:${ip}` : ip;
  const { success, limit, remaining, reset } = await ratelimit.limit(key);

  res.setHeader('X-RateLimit-Limit', limit);
  res.setHeader('X-RateLimit-Remaining', remaining);
  res.setHeader('X-RateLimit-Reset', reset);

  if (!success) {
    res.status(429).json({ error: 'Too many requests. Please try again later.' });
    return false;
  }
  return true;
}
