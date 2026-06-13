// @ts-check
const { withSentryConfig } = require('@sentry/nextjs');
const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
});

/** @type {import('next').NextConfig} */

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), serial=(), hid=(), ambient-light-sensor=(), accelerometer=(), gyroscope=(), magnetometer=()' },
  // CSP is set per-request via middleware.ts using a nonce — no static header here.
];

const isExport = process.env.NEXT_EXPORT === 'true';

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // Static export for mobile OTA bundles (NEXT_EXPORT=true set by GitHub Actions).
  // Netlify web build runs without this flag and keeps full Next.js + API routes.
  ...(isExport ? {
    output: 'export',
    images: { unoptimized: true },
    trailingSlash: true,
  } : {}),
  // Security headers only apply when running as a Next.js server (Netlify).
  // For static export these are set in netlify.toml at the CDN layer.
  ...(!isExport ? {
    async headers() {
      return [{ source: '/(.*)', headers: securityHeaders }];
    },
  } : {}),
};

module.exports = withSentryConfig(withPWA(nextConfig), {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
});
