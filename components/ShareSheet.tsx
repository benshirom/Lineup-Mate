import { useEffect, useRef, useState } from 'react';

interface ShareSheetProps {
  url: string;
  title: string;
  text: string;
  onClose: () => void;
}

function isNative(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Capacitor } = require('@capacitor/core');
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

async function openExternalUrl(url: string): Promise<void> {
  if (isNative()) {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url });
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

async function nativeShare(shareData: { title: string; text: string; url: string }): Promise<boolean> {
  if (isNative()) {
    const { Share } = await import('@capacitor/share');
    await Share.share(shareData);
    return true;
  }
  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    await navigator.share(shareData);
    return true;
  }
  return false;
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
    } catch {
      // Fallback for environments without clipboard API
      const el = document.createElement('textarea');
      el.value = url;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => { setCopied(false); onClose(); }, 1800);
  };

  const shareWhatsApp = async () => {
    await openExternalUrl(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`);
    onClose();
  };

  const shareTelegram = async () => {
    await openExternalUrl(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`);
    onClose();
  };

  const shareNativeOrSystem = async () => {
    const shared = await nativeShare({ title, text, url });
    if (shared) onClose();
  };

  const hasNativeShare = isNative() || (typeof navigator !== 'undefined' && 'share' in navigator);

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
          Share Group
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
            {copied ? 'Link copied!' : 'Copy link'}
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

          {hasNativeShare && (
            <button
              type="button"
              onClick={shareNativeOrSystem}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-bold transition-all"
              style={{
                background: 'rgba(255,255,255,0.06)',
                color: '#f1f5f9',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <span className="text-lg">📤</span>
              More…
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-2xl py-3 text-sm font-bold"
          style={{ background: 'rgba(255,255,255,0.04)', color: '#64748b' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
