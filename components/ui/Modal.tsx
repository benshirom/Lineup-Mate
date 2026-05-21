import React, { useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { createDesignSystem } from '@/lib/designSystem';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: number;
}

export const Modal: React.FC<ModalProps> = ({ open, onClose, children, maxWidth = 400 }) => {
  const { theme } = useAuth();
  const ds = createDesignSystem(theme);

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
        className="slide-up w-full overflow-hidden"
        style={{
          maxWidth,
          background: ds.colors.surface,
          border: `1px solid ${ds.colors.border}`,
          borderRadius: ds.radii.modal,
          boxShadow: ds.shadows.elevated,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

export default Modal;
