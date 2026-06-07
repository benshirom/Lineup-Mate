import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { isPushSupported, subscribeToPush } from '@/lib/pushNotifications';

interface Props {
  onDone: () => void;
}

const InstallNotificationPrompt: React.FC<Props> = ({ onDone }) => {
  const { session } = useAuth();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const supported = await isPushSupported();
      if (supported && Notification.permission === 'default') {
        setVisible(true);
      } else {
        onDone();
      }
    })();
  }, [onDone]);

  const handleEnable = async () => {
    setLoading(true);
    const token = session?.access_token ?? '';
    await subscribeToPush(token);
    setLoading(false);
    onDone();
  };

  if (!visible) return null;

  return (
    <div
      dir="rtl"
      className="fixed bottom-16 inset-x-3 z-50 rounded-2xl p-4 shadow-xl"
      style={{ background: '#1a1040', border: '1px solid #8B5CF6' }}
    >
      <p className="font-bold text-sm mb-3" style={{ color: '#e2d9f3' }}>
        רוצה לקבל עדכונים על הופעות?
      </p>
      <div className="flex gap-2">
        <button
          onClick={handleEnable}
          disabled={loading}
          className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-60"
          style={{ background: '#8B5CF6' }}
        >
          {loading ? '...' : 'הפעל התראות'}
        </button>
        <button
          onClick={onDone}
          className="flex-1 rounded-xl py-2.5 text-sm font-bold"
          style={{ background: '#2d1f5e', color: '#a78bfa' }}
        >
          לא עכשיו
        </button>
      </div>
    </div>
  );
};

export default InstallNotificationPrompt;
