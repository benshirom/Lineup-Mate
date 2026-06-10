import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { createDesignSystem } from '@/lib/designSystem';

interface Notification {
  id: number;
  type: string;
  title: string;
  body: string;
  is_read: boolean | null;
  created_at: string | null;
  performance_id: number | null;
  group_id: number | null;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const instanceCounter = { n: 0 };

export function NotificationBell() {
  const { user, supabase, theme, t } = useAuth();
  const c = createDesignSystem(theme).colors;
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const instanceId = useRef(`bell-${++instanceCounter.n}`).current;

  const unreadCount = notifications.filter(n => !n.is_read).length;

  // Fetch + Realtime subscription
  useEffect(() => {
    if (!user) return;

    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => setNotifications(data ?? []));

    const channel = supabase
      .channel(`notifications:${user.id}:${instanceId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setNotifications(prev => [payload.new as Notification, ...prev.slice(0, 19)]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, supabase]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const markAllRead = async () => {
    if (!user || unreadCount === 0) return;
    const { error } = await supabase.rpc('mark_all_notifications_read');
    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    }
  };

  const handleOpen = () => {
    setOpen(o => !o);
    if (!open && unreadCount > 0) {
      setTimeout(markAllRead, 2000);
    }
  };

  if (!user) return null;

  return (
    <div ref={wrapperRef} className="relative" data-testid="notification-bell">
      <button
        type="button"
        onClick={handleOpen}
        aria-label={`${t.notifications}${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-base transition-opacity hover:opacity-80"
        style={{
          background: c.surf2,
          border: `1px solid ${c.brd}`,
          color: c.txt,
        }}
      >
        🔔
        {unreadCount > 0 && (
          <span data-testid="notification-badge" className="notif-badge">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="notif-dropdown"
          style={{ background: c.surf, border: `1px solid ${c.brd}` }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: c.brd }}>
            <span className="text-sm font-extrabold" style={{ color: c.txt }}>{t.notifications}</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs font-bold"
                style={{ color: c.acc }}
              >
                {t.notificationsMarkRead}
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm" style={{ color: c.muted }}>
              {t.notificationsEmpty}
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: c.brd }}>
              {notifications.map(n => (
                <div
                  key={n.id}
                  className="px-4 py-3 transition-colors"
                  style={{
                    background: n.is_read ? 'transparent' : `${c.acc}08`,
                    borderBottom: `1px solid ${c.brd}`,
                  }}
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 text-base shrink-0">
                      {n.type === 'set_starting' ? '🎵' : n.type === 'group_change' ? '👥' : '📢'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold leading-snug" style={{ color: c.txt }}>{n.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: c.muted }}>{n.body}</p>
                      <p className="text-[10px] mt-1 font-semibold" style={{ color: c.muted }}>{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.is_read && (
                      <div className="mt-1.5 h-2 w-2 rounded-full shrink-0" style={{ background: c.acc }} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
