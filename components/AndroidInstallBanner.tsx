import React, { useEffect, useState } from 'react';

const STORAGE_KEY = 'android-install-dismissed';

const AndroidInstallBanner: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (navigator.webdriver || window.location.hostname === '127.0.0.1') return;
    const isAndroid = /Android/.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const dismissed = localStorage.getItem(STORAGE_KEY);

    if (isAndroid && !isStandalone && !dismissed) {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      dir="rtl"
      className="fixed top-0 inset-x-0 z-50 flex items-start gap-3 px-4 py-3 shadow-lg"
      style={{ background: '#1a1040', borderBottom: '1px solid #8B5CF6' }}
    >
      {/* App icon */}
      <div
        className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-sm mt-0.5"
        style={{ background: '#8B5CF6' }}
      >
        LM
      </div>

      <div className="flex-1 min-w-0" style={{ color: '#e2d9f3' }}>
        <p className="font-bold text-sm leading-tight">Lineup Mate</p>
        <p className="text-xs mt-0.5" style={{ color: '#a78bfa' }}>
          הוסף למסך הבית: לחץ על{' '}
          <span className="font-bold" style={{ color: '#c4b5fd' }}>⋮ התפריט</span>
          {' '}ואז{' '}
          <span className="font-bold" style={{ color: '#c4b5fd' }}>"הוסף למסך הבית"</span>
        </p>
      </div>

      <button
        onClick={dismiss}
        aria-label="סגור"
        className="flex-shrink-0 text-gray-400 hover:text-white transition-colors mt-0.5"
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
