import '../styles/globals.css';
import type { AppProps } from 'next/app';
import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import BottomNav from '@/components/BottomNav';
import IOSInstallBanner from '@/components/IOSInstallBanner';
import AndroidInstallBanner from '@/components/AndroidInstallBanner';
import UpdaterInit from '@/components/UpdaterInit';

function AppShell({ Component, pageProps }: AppProps) {
  const { user } = useAuth();
  return (
    <>
      <Component {...pageProps} />
      {user && (
        <>
          <BottomNav />
          {/* spacer so content is not hidden behind the fixed BottomNav (60px + safe-area-inset-bottom) */}
          <div className="md:hidden" style={{ height: 'calc(60px + env(safe-area-inset-bottom, 0px))' }} aria-hidden="true" />
        </>
      )}
    </>
  );
}

function useCapacitorDeepLinks(router: ReturnType<typeof useRouter>) {
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    (async () => {
      try {
        const { App } = await import('@capacitor/app');
        const { remove } = await App.addListener('appUrlOpen', ({ url }) => {
          try {
            const path = new URL(url).pathname + (new URL(url).search ?? '');
            if (path) router.push(path);
          } catch { /* invalid URL */ }
        });
        cleanup = remove;
      } catch { /* not in Capacitor */ }
    })();
    return () => { cleanup?.(); };
  }, [router]);
}

export default function MyApp(props: AppProps) {
  const router = useRouter();
  useCapacitorDeepLinks(router);

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:z-50 focus-visible:rounded-xl focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-black focus-visible:text-white"
        style={{ insetInlineStart: 16, top: 16, background: '#8B5CF6' }}
      >
        דלג לתוכן הראשי
      </a>
      <AuthProvider onNavigate={(path) => router.push(path)}>
        <IOSInstallBanner />
        <AndroidInstallBanner />
        <AppShell {...props} />
        <UpdaterInit />
      </AuthProvider>
    </>
  );
}
