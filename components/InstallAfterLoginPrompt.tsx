import React, { useEffect, useState } from 'react';

const SESSION_KEY = 'pendingInstall';

const InstallAfterLoginPrompt: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) !== '1') return;
    sessionStorage.removeItem(SESSION_KEY);
    const hasMobile = /iPhone|iPad|iPod|Android/.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (hasMobile && !isStandalone && typeof navigator.share === 'function') {
      setVisible(true);
    }
  }, []);

  const handleShare = async () => {
    try {
      await navigator.share({ title: 'Lineup Mate', url: window.location.href });
    } catch { /* cancelled */ }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-16 inset-x-3 z-50 rounded-2xl p-4 shadow-xl"
      style={{ background: '#1a1040', border: '1px solid #8B5CF6' }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-sm"
          style={{ background: '#8B5CF6' }}
        >
          LM
        </div>
        <div className="flex-1 min-w-0" style={{ color: '#e2d9f3' }}>
          <p className="font-bold text-sm">Add to Home Screen</p>
          <p className="text-xs mt-0.5" style={{ color: '#a78bfa' }}>Tap to continue</p>
        </div>
        <button
          onClick={() => setVisible(false)}
          aria-label="Close"
          className="flex-shrink-0 text-gray-400 hover:text-white transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <button
        onClick={handleShare}
        className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white"
        style={{ background: '#8B5CF6' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
        </svg>
        Add to Home Screen
      </button>
    </div>
  );
};

export default InstallAfterLoginPrompt;
