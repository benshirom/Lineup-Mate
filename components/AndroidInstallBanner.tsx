import React, { useEffect, useState, useRef } from 'react';

const STORAGE_KEY = 'android-install-dismissed';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.lineupmate.app';

// BeforeInstallPromptEvent is not in standard TS types
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const AndroidInstallBanner: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const isAndroid = /Android/.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const dismissed = localStorage.getItem(STORAGE_KEY);

    if (!isAndroid || isStandalone || dismissed) return;

    // Listen for native install prompt (Chrome on Android)
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Always show the banner for Android browsers regardless of native prompt
    setVisible(true);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt.current) {
      // Use native Chrome install prompt if available
      await deferredPrompt.current.prompt();
      const { outcome } = await deferredPrompt.current.userChoice;
      if (outcome === 'accepted') {
        dismiss();
        return;
      }
    }
    // Fallback: open Play Store
    window.open(PLAY_STORE_URL, '_blank', 'noopener');
    dismiss();
  };

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      dir="rtl"
      className="fixed top-0 inset-x-0 z-50 flex items-center gap-3 px-4 py-3 shadow-lg"
      style={{ background: '#1a1040', borderBottom: '1px solid #8B5CF6' }}
    >
      {/* App icon placeholder */}
      <div
        className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-sm"
        style={{ background: '#8B5CF6' }}
      >
        LM
      </div>

      <div className="flex-1 min-w-0" style={{ color: '#e2d9f3' }}>
        <p className="font-bold text-sm leading-tight">Lineup Mate</p>
        <p className="text-xs" style={{ color: '#a78bfa' }}>הורד מ-Google Play לחוויה טובה יותר</p>
      </div>

      <button
        onClick={handleInstall}
        className="flex-shrink-0 rounded-xl px-4 py-1.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
        style={{ background: '#8B5CF6' }}
      >
        הורד
      </button>

      <button
        onClick={dismiss}
        aria-label="סגור"
        className="flex-shrink-0 text-gray-400 hover:text-white transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
};

export default AndroidInstallBanner;
