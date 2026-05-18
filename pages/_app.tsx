import '../styles/globals.css';
import type { AppProps } from 'next/app';
import React from 'react';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import BottomNav from '@/components/BottomNav';

function AppShell({ Component, pageProps }: AppProps) {
  const { user } = useAuth();
  return (
    <>
      <Component {...pageProps} />
      {user && (
        <>
          <BottomNav />
          {/* spacer so content is not hidden behind the fixed bottom bar */}
          <div className="md:hidden h-24" aria-hidden="true" />
        </>
      )}
    </>
  );
}

export default function MyApp(props: AppProps) {
  return (
    <AuthProvider>
      <AppShell {...props} />
    </AuthProvider>
  );
}
