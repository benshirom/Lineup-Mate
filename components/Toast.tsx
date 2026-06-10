import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { createDesignSystem } from '@/lib/designSystem';

interface ToastProps {
  message: string;
  duration?: number;
  onClose: () => void;
}

export function Toast({ message, duration = 4000, onClose }: ToastProps) {
  const [visible, setVisible] = useState(true);
  const { theme } = useAuth();
  const c = createDesignSystem(theme).colors;

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div
      className="toast-slide-in fixed left-1/2 z-50 max-w-xs rounded-2xl px-4 py-3 text-sm font-bold shadow-xl"
      style={{
        bottom: 'max(96px, calc(72px + env(safe-area-inset-bottom, 0px) + 8px))',
        transform: 'translateX(-50%)',
        background: c.surf2,
        color: c.txt,
        border: `1px solid ${c.brd}`,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s ease',
      }}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (message: string) => setToast(message);
  const clearToast = () => setToast(null);

  const ToastElement = toast ? (
    <Toast message={toast} onClose={clearToast} />
  ) : null;

  return { showToast, ToastElement };
}
