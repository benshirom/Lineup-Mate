// @ts-check
const { withSentryConfig } = require('@sentry/nextjs');

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
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://res.cloudinary.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "font-src 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  },
];

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
});
