import React, { useEffect, useState } from 'react';

const STORAGE_KEY = 'ios-install-dismissed';

const IOSInstallBanner: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (navigator.webdriver || window.location.hostname === '127.0.0.1') return; // skip during Playwright / automated tests
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const dismissed = localStorage.getItem(STORAGE_KEY);

    if (isIOS && isSafari && !isStandalone && !dismissed) {
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
      className="fixed bottom-16 inset-x-3 z-50 rounded-2xl p-4 flex items-start gap-3 shadow-xl"
      style={{ background: '#1a1040', border: '1px solid #8B5CF6' }}
    >
      {/* Share icon */}
      <div className="flex-shrink-0 mt-0.5">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
      </div>

      <div className="flex-1 text-sm" style={{ color: '#e2d9f3' }}>
        <p className="font-bold mb-1" style={{ color: '#8B5CF6' }}>הוסף למסך הבית</p>
        <p>לחץ על <strong>כפתור השיתוף</strong> ואז בחר <strong>"הוסף למסך הבית"</strong> לגישה מהירה לאפליקציה.</p>
      </div>

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

export default IOSInstallBanner;
