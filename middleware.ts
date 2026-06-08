import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Edge Runtime: use Web Crypto API (no Node.js 'crypto' import or Buffer).
function generateNonce(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  // btoa(String.fromCharCode(...)) converts bytes to base64 without Buffer.
  return btoa(String.fromCharCode(...bytes));
}

export function middleware(request: NextRequest) {
  const nonce = generateNonce();

  // Build CSP: nonce for scripts instead of 'unsafe-inline'.
  // 'strict-dynamic' propagates trust to scripts dynamically loaded by trusted scripts,
  // which is required for the Next.js Pages Router runtime.
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'nonce-${nonce}' 'unsafe-inline'`,
    "img-src 'self' data: blob: https://res.cloudinary.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "font-src 'self' https://fonts.gstatic.com",
    "frame-ancestors 'none'",
  ].join('; ');

  // Pass nonce to _document.tsx via request header.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  response.headers.set('Content-Security-Policy', csp);

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|ttf|eot)).*)',
  ],
};
