import { useEffect, useRef, useState } from 'react';

interface ShareSheetProps {
  url: string;
  title: string;
  text: string;
  onClose: () => void;
}

export function ShareSheet({ url, title, text, onClose }: ShareSheetProps) {
  const [copied, setCopied] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => { setCopied(false); onClose(); }, 1800);
    } catch {
      // fallback for older browsers
      const el = document.createElement('textarea');
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => { setCopied(false); onClose(); }, 1800);
    }
  };

  const shareWhatsApp = () => {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`,
      '_blank',
      'noopener,noreferrer'
    );
    onClose();
  };

  const shareTelegram = () => {
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
      '_blank',
      'noopener,noreferrer'
    );
    onClose();
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        onClose();
      } catch {
        // user cancelled
      }
    }
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        data-testid="share-sheet"
        className="slide-up w-full max-w-sm rounded-t-[28px] sm:rounded-[28px] p-6 shadow-2xl"
        style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 text-center text-xs font-extrabold uppercase tracking-widest" style={{ color: '#64748b' }}>
          שיתוף קבוצה
        </div>
        <h3 className="mb-5 text-center text-base font-bold" style={{ color: '#f1f5f9' }}>
          {title}
        </h3>

        <div className="space-y-2.5">
          <button
            type="button"
            data-testid="share-copy-link"
            onClick={copyLink}
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-bold transition-all"
            style={{
              background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)',
              color: copied ? '#4ade80' : '#f1f5f9',
              border: `1px solid ${copied ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)'}`,
            }}
          >
            <span className="text-lg">{copied ? '✓' : '🔗'}</span>
            {copied ? 'הקישור הועתק!' : 'העתק קישור'}
          </button>

          <button
            type="button"
            onClick={shareWhatsApp}
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-bold transition-all"
            style={{
              background: 'rgba(37,211,102,0.1)',
              color: '#f1f5f9',
              border: '1px solid rgba(37,211,102,0.25)',
            }}
          >
            <span className="text-lg">💬</span>
            WhatsApp
          </button>

          <button
            type="button"
            onClick={shareTelegram}
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-bold transition-all"
            style={{
              background: 'rgba(38,150,208,0.1)',
              color: '#f1f5f9',
              border: '1px solid rgba(38,150,208,0.25)',
            }}
          >
            <span className="text-lg">✈️</span>
            Telegram
          </button>

          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <button
              type="button"
              onClick={shareNative}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-bold transition-all"
              style={{
                background: 'rgba(255,255,255,0.06)',
                color: '#f1f5f9',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <span className="text-lg">📤</span>
              שיתוף נוסף…
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-2xl py-3 text-sm font-bold"
          style={{ background: 'rgba(255,255,255,0.04)', color: '#64748b' }}
        >
          ביטול
        </button>
      </div>
    </div>
  );
}
