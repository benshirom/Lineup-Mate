import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import crypto from 'crypto';

export function middleware(request: NextRequest) {
  // Generate a cryptographically random nonce for this request.
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  // Build CSP: use nonce for scripts/styles instead of 'unsafe-inline'.
  // 'strict-dynamic' propagates trust to scripts dynamically loaded by trusted scripts,
  // which is required for the Next.js Pages Router runtime.
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'nonce-${nonce}' 'unsafe-inline'`, // unsafe-inline kept for style tags; nonce preferred
    "img-src 'self' data: blob: https://res.cloudinary.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "font-src 'self' https://fonts.gstatic.com",
    "frame-ancestors 'none'",
  ].join('; ');

  // Clone the request and add the nonce header so _document.tsx can read it.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  response.headers.set('Content-Security-Policy', csp);

  return response;
}

export const config = {
  // Apply to all routes except static files and Next.js internals.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|ttf|eot)).*)',
  ],
};
