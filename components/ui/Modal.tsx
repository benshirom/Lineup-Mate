import React, { useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getThemeColors } from '@/lib/platform';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: number;
}

export const Modal: React.FC<ModalProps> = ({ open, onClose, children, maxWidth = 400 }) => {
  const { theme } = useAuth();
  const c = getThemeColors(theme);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="slide-up w-full overflow-hidden rounded-[28px] shadow-elevated"
        style={{
          maxWidth,
          background: c.surf,
          border: `1px solid ${c.brd}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

export default Modal;
