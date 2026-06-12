import '../styles/globals.css';
import type { AppProps } from 'next/app';
import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import BottomNav from '@/components/BottomNav';
import IOSInstallBanner from '@/components/IOSInstallBanner';
import AndroidInstallBanner from '@/components/AndroidInstallBanner';

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
      <AuthProvider onNavigate={(path) => router.push(path)}>
        <IOSInstallBanner />
        <AndroidInstallBanner />
        <AppShell {...props} />
      </AuthProvider>
    </>
  );
}
