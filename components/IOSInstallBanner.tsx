import React, { useEffect, useState } from 'react';
import InstallNotificationPrompt from './InstallNotificationPrompt';

const STORAGE_KEY = 'ios-install-dismissed';
const EXPIRE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

const IOSInstallBanner: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    if (navigator.webdriver || window.location.hostname === '127.0.0.1') return;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

    if (!isIOS || !isSafari || isStandalone) return;

    const ts = localStorage.getItem(STORAGE_KEY);
    const dismissed = ts !== null && Date.now() - Number(ts) < EXPIRE_MS;
    if (dismissed) return;

    setVisible(true);
    setCanShare(typeof navigator.share === 'function');
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
    setVisible(false);
    setShowNotifPrompt(true);
  };

  const handleShare = async () => {
    try {
      await navigator.share({ title: 'Lineup Mate', url: window.location.href });
    } catch { /* cancelled */ }
  };

  if (showNotifPrompt) {
    return <InstallNotificationPrompt onDone={() => setShowNotifPrompt(false)} />;
  }

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-16 inset-x-3 z-50 rounded-2xl p-4 shadow-xl"
      style={{ background: '#1a1040', border: '1px solid #8B5CF6' }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-sm mt-0.5"
          style={{ background: '#8B5CF6' }}
        >
          LM
        </div>

        <div className="flex-1 min-w-0" style={{ color: '#e2d9f3' }}>
          <p className="font-bold text-sm leading-tight">Lineup Mate</p>
          <p className="text-xs mt-0.5" style={{ color: '#a78bfa' }}>
            Add to Home Screen for quick access
          </p>
        </div>

        <button
          onClick={dismiss}
          aria-label="Close"
          className="flex-shrink-0 text-gray-400 hover:text-white transition-colors mt-0.5"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="mt-3">
        {canShare ? (
          <button
            onClick={handleShare}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white"
            style={{ background: '#8B5CF6' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            Add to Home Screen
          </button>
        ) : (
          <p className="text-xs text-center" style={{ color: '#a78bfa' }}>
            Tap the{' '}
            <strong style={{ color: '#c4b5fd' }}>Share button</strong>
            {' '}then{' '}
            <strong style={{ color: '#c4b5fd' }}>&quot;Add to Home Screen&quot;</strong>
          </p>
        )}
      </div>
    </div>
  );
};

export default IOSInstallBanner;
