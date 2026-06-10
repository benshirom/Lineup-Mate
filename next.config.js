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
  // CSP is managed via static headers. unsafe-inline is required for Next.js Pages Router
  // inline scripts. A nonce-based approach is desirable but requires careful integration
  // with the Supabase auth flow and PWA service worker before deployment.
  // script-src is restricted to known domains to reduce wildcard surface area.
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://*.supabase.co https://*.sentry.io https://*.ingest.sentry.io https://*.ingest.de.sentry.io",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https://res.cloudinary.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io https://*.ingest.sentry.io https://*.ingest.de.sentry.io",
      "font-src 'self' https://fonts.gstatic.com",
      "worker-src 'self'",
      "manifest-src 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  },
];

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // When NEXT_EXPORT=true (mobile build via Capacitor), emit a fully-static site.
  // API routes are not included in the static export; the mobile app calls the
  // Netlify-hosted API directly via NEXT_PUBLIC_APP_URL.
  ...(process.env.NEXT_EXPORT === 'true' ? { output: 'export' } : {}),
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = withSentryConfig(withPWA(nextConfig), {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
});
