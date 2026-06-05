import { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  duration?: number;
  onClose: () => void;
}

export function Toast({ message, duration = 4000, onClose }: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div
      className="toast-slide-in fixed bottom-24 left-1/2 z-50 max-w-xs rounded-2xl px-4 py-3 text-sm font-bold shadow-xl"
      style={{
        transform: 'translateX(-50%)',
        background: '#1e293b',
        color: '#f1f5f9',
        border: '1px solid rgba(255,255,255,0.1)',
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
