import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getThemeColors } from '@/lib/platform';

interface Prefs {
  notify_set_starting: boolean;
  notify_before_minutes: number;
  notify_group_changes: boolean;
}

const MINUTE_OPTIONS = [10, 15, 30, 60];

export function NotificationPreferences() {
  const { user, supabase, theme, t } = useAuth();
  const c = getThemeColors(theme);
  const [prefs, setPrefs] = useState<Prefs>({
    notify_set_starting: true,
    notify_before_minutes: 15,
    notify_group_changes: true,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('notification_preferences')
      .select('notify_set_starting, notify_before_minutes, notify_group_changes')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setPrefs({
            notify_set_starting: data.notify_set_starting ?? true,
            notify_before_minutes: data.notify_before_minutes ?? 15,
            notify_group_changes: data.notify_group_changes ?? true,
          });
        }
        setLoading(false);
      });
  }, [user, supabase]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    await supabase
      .from('notification_preferences')
      .upsert({ user_id: user.id, ...prefs, updated_at: new Date().toISOString() });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!user || loading) return null;

  return (
    <form
      data-testid="notification-prefs-form"
      onSubmit={(e) => { e.preventDefault(); handleSave(); }}
      className="rounded-3xl p-5 space-y-4"
      style={{ background: c.surf, border: `1px solid ${c.brd}` }}
    >
      <h2 className="text-lg font-extrabold">{t.notifPrefsTitle}</h2>

      <label className="flex items-center justify-between gap-4 cursor-pointer">
        <div>
          <p className="text-sm font-bold" style={{ color: c.txt }}>{t.notifPrefsSetStarting}</p>
          <p className="text-xs mt-0.5" style={{ color: c.muted }}>
            {t.notifPrefsSetStartingDesc}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={prefs.notify_set_starting}
          onClick={() => setPrefs(p => ({ ...p, notify_set_starting: !p.notify_set_starting }))}
          className="relative h-6 w-11 rounded-full transition-colors shrink-0"
          style={{
            background: prefs.notify_set_starting ? c.acc : c.surf2,
            border: `1px solid ${prefs.notify_set_starting ? c.acc : c.brd}`,
          }}
        >
          <span
            className="absolute top-0.5 h-5 w-5 rounded-full transition-transform"
            style={{
              background: '#fff',
              transform: prefs.notify_set_starting ? 'translateX(20px)' : 'translateX(2px)',
            }}
          />
        </button>
      </label>

      {prefs.notify_set_starting && (
        <div>
          <p className="text-xs font-bold mb-2" style={{ color: c.muted }}>{t.notifPrefsMinutesBefore}</p>
          <div className="flex gap-2 flex-wrap">
            {MINUTE_OPTIONS.map(mins => (
              <button
                key={mins}
                type="button"
                onClick={() => setPrefs(p => ({ ...p, notify_before_minutes: mins }))}
                className="rounded-full px-3 py-1.5 text-xs font-bold transition-all"
                style={{
                  background: prefs.notify_before_minutes === mins ? c.acc : c.surf2,
                  color: prefs.notify_before_minutes === mins ? '#fff' : c.muted,
                  border: `1px solid ${prefs.notify_before_minutes === mins ? c.acc : c.brd}`,
                }}
              >
                {mins} min
              </button>
            ))}
          </div>
        </div>
      )}

      <label className="flex items-center justify-between gap-4 cursor-pointer">
        <div>
          <p className="text-sm font-bold" style={{ color: c.txt }}>{t.notifPrefsGroupChanges}</p>
          <p className="text-xs mt-0.5" style={{ color: c.muted }}>
            {t.notifPrefsGroupChangesDesc}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={prefs.notify_group_changes}
          onClick={() => setPrefs(p => ({ ...p, notify_group_changes: !p.notify_group_changes }))}
          className="relative h-6 w-11 rounded-full transition-colors shrink-0"
          style={{
            background: prefs.notify_group_changes ? c.acc : c.surf2,
            border: `1px solid ${prefs.notify_group_changes ? c.acc : c.brd}`,
          }}
        >
          <span
            className="absolute top-0.5 h-5 w-5 rounded-full transition-transform"
            style={{
              background: '#fff',
              transform: prefs.notify_group_changes ? 'translateX(20px)' : 'translateX(2px)',
            }}
          />
        </button>
      </label>

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-2xl py-3 text-sm font-bold text-white disabled:opacity-50 tap-active"
        style={{ background: saved ? c.success : c.acc }}
      >
        {saving ? t.notifPrefsSaving : saved ? t.notifPrefsSaved : t.notifPrefsSave}
      </button>
    </form>
  );
}
