import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Navbar from '@/components/Navbar';
import { NotificationPreferences } from '@/components/NotificationPreferences';
import { useAuth } from '@/lib/AuthContext';
import { getThemeColors, type ThemeMode } from '@/lib/platform';

type UserRole = 'user' | 'admin';

interface ProfileData {
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  theme: ThemeMode;
  created_at: string | null;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read avatar file.'));
    reader.readAsDataURL(file);
  });
}

function AppInstallCard() {
  const [show, setShow] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const { theme } = useAuth();
  const c = getThemeColors(theme);

  useEffect(() => {
    const isMobile = /iPhone|iPad|iPod|Android/.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isNative = !!(window as any).Capacitor?.isNativePlatform?.();
    if (isMobile && !isStandalone && !isNative) {
      setShow(true);
      setCanShare(typeof navigator.share === 'function');
    }
  }, []);

  const handleShare = useCallback(async () => {
    try {
      await navigator.share({ title: 'Lineup Mate', url: window.location.href });
    } catch { /* cancelled */ }
  }, []);

  if (!show) return null;

  return (
    <div className="rounded-[28px] p-5 lg:col-span-2" style={{ background: c.surf, border: `1px solid ${c.acc}` }}>
      <h2 className="mb-1 text-xl font-black" style={{ color: c.txt }}>App Settings</h2>
      <p className="mb-4 text-sm" style={{ color: c.muted }}>Add Lineup Mate to your Home Screen for quick access.</p>
      {canShare ? (
        <button
          onClick={handleShare}
          className="flex items-center gap-2 rounded-full px-5 py-3 text-sm font-black text-white"
          style={{ background: c.acc }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
          </svg>
          Add to Home Screen
        </button>
      ) : (
        <p className="text-sm" style={{ color: c.muted }}>
          Tap <strong>⋮ Menu</strong> then <strong>&quot;Add to Home Screen&quot;</strong>
        </p>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, session, authReady, supabase, theme: currentTheme, setLocalPreferences, t } = useAuth();
  const c = getThemeColors(currentTheme);

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [theme, setTheme] = useState<ThemeMode>(currentTheme);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [exportingData, setExportingData] = useState(false);

  useEffect(() => {
    if (!authReady) return;

    if (!user) {
      router.push('/login');
      return;
    }

    const loadProfile = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: profileError } = await supabase
          .from('profiles')
          .select('email, display_name, avatar_url, role, theme, created_at')
          .eq('id', user.id)
          .single();

        if (profileError) throw profileError;

        const nextProfile: ProfileData = {
          email: data.email ?? user.email ?? null,
          display_name: data.display_name ?? null,
          avatar_url: data.avatar_url ?? null,
          role: data.role === 'admin' ? 'admin' : 'user',
          theme: data.theme === 'light' ? 'light' : 'dark',
          created_at: data.created_at ?? null
        };

        setProfile(nextProfile);
        setDisplayName(nextProfile.display_name || '');
        setAvatarUrl(nextProfile.avatar_url || '');
        setAvatarPreview(nextProfile.avatar_url || '');
        setTheme(nextProfile.theme);
        setLocalPreferences({ theme: nextProfile.theme });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Could not load your profile.');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [authReady, router, supabase, user, setLocalPreferences]);

  const handleThemeChange = (nextTheme: ThemeMode) => {
    setTheme(nextTheme);
    setLocalPreferences({ theme: nextTheme });
  };

  const handleAvatarFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setAvatarFile(file);
    setMessage(null);
    setError(null);

    if (!file) {
      setAvatarPreview(avatarUrl);
      return;
    }

    if (!file.type.startsWith('image/')) {
      setAvatarFile(null);
      setError('Please choose an image file.');
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      setAvatarFile(null);
      setError('Avatar image must be smaller than 4MB.');
      return;
    }

    setAvatarPreview(URL.createObjectURL(file));
  };

  const uploadAvatarIfNeeded = async () => {
    if (!avatarFile) return avatarUrl.trim() || null;
    if (!session?.access_token) throw new Error('Missing session token. Please sign in again.');

    setUploadingAvatar(true);
    try {
      const fileDataUrl = await fileToDataUrl(avatarFile);
      const response = await fetch('/api/profile/avatar-upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ file: fileDataUrl })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Could not upload avatar.');
      if (!payload.secure_url) throw new Error('Cloudinary upload did not return a secure URL.');

      return payload.secure_url as string;
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;

    if (displayName.trim().length > 100) {
      setError('Display name must be 100 characters or less.');
      return;
    }

    const selectedTheme = theme;
    setSaving(true);
    setError(null);
    setMessage(null);
    setLocalPreferences({ theme: selectedTheme });

    try {
      const uploadedAvatarUrl = await uploadAvatarIfNeeded();

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim() || null,
          avatar_url: uploadedAvatarUrl,
          theme: selectedTheme
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setAvatarUrl(uploadedAvatarUrl || '');
      setAvatarPreview(uploadedAvatarUrl || '');
      setAvatarFile(null);
      setProfile((current) => current ? {
        ...current,
        display_name: displayName.trim() || null,
        avatar_url: uploadedAvatarUrl,
        theme: selectedTheme
      } : current);

      setLocalPreferences({ theme: selectedTheme });
      setMessage('Profile saved successfully.');
    } catch (err: unknown) {
      setLocalPreferences({ theme: selectedTheme });
      setError(err instanceof Error ? err.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleExportData = async () => {
    if (!session) return;
    setExportingData(true);
    try {
      const response = await fetch('/api/profile/export-data', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'lineup-mate-data.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Could not export your data. Please try again.');
    } finally {
      setExportingData(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!session) return;
    const confirmed = window.confirm(
      'Are you sure you want to permanently delete your account? This cannot be undone.'
    );
    if (!confirmed) return;
    setDeletingAccount(true);
    try {
      const response = await fetch('/api/profile/delete-account', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!response.ok) throw new Error('Deletion failed');
      await supabase.auth.signOut();
      router.push('/');
    } catch {
      setError('Could not delete your account. Please try again.');
      setDeletingAccount(false);
    }
  };

  return (
    <>
      <Navbar />
      <main className="mobile-shell-padding" style={{ minHeight: '100dvh', background: c.bg, color: c.txt }}>
        <section className="mx-auto max-w-4xl px-4 py-8">
          <header className="mb-6 rounded-[28px] p-6 shadow-2xl" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
            <p className="text-xs font-extrabold uppercase tracking-widest" style={{ color: c.acc }}>{t.appName}</p>
            <h1 className="text-4xl font-black" style={{ fontFamily: 'Syne, Nunito, sans-serif' }}>{t.navProfile}</h1>
            <p className="mt-2 text-sm" style={{ color: c.muted }}>Manage your display name, avatar and account preferences.</p>
          </header>

          {(!authReady || loading) && <p style={{ color: c.muted }}>Loading profile…</p>}
          {error && <p className="mb-4 rounded-xl p-4 text-sm text-red-700" style={{ background: '#fee2e2', border: '1px solid #fecaca' }}>{error}</p>}
          {message && <p className="mb-4 rounded-xl p-4 text-sm text-green-700" style={{ background: '#dcfce7', border: '1px solid #bbf7d0' }}>{message}</p>}

          {authReady && !loading && profile && (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
              <aside className="rounded-[28px] p-5" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
                <div data-testid="profile-avatar-preview" className="mb-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-[28px] text-4xl font-black" style={{ background: `${c.acc}22`, color: c.acc }}>
                  {avatarPreview ? <img src={avatarPreview} alt="Profile avatar" className="h-full w-full object-cover" /> : (displayName || profile.email || 'U').slice(0, 1).toUpperCase()}
                </div>
                <h2 className="text-xl font-black">{displayName || profile.email || 'User'}</h2>
                <p className="mt-1 text-sm" style={{ color: c.muted }}>{profile.email}</p>
                <div className="mt-4 space-y-2 text-sm" style={{ color: c.muted }}>
                  <div><b style={{ color: c.txt }}>Account type:</b> {profile.role}</div>
                  <div><b style={{ color: c.txt }}>Theme:</b> {theme}</div>
                  {profile.created_at && <div><b style={{ color: c.txt }}>Joined:</b> {new Date(profile.created_at).toLocaleDateString()}</div>}
                </div>
              </aside>

              <form onSubmit={handleSave} className="rounded-[28px] p-5" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
                <h2 className="mb-4 text-2xl font-black">Account details</h2>

                <div className="space-y-4">
                  <label className="block">
                    <span className="mb-1 block text-sm font-black">Display Name</span>
                    <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Your display name" className="w-full rounded-2xl px-4 py-3 text-sm outline-none" style={{ background: c.surf2, border: `1px solid ${c.brd}`, color: c.txt }} />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-sm font-black">Email</span>
                    <input value={profile.email || ''} disabled className="w-full rounded-2xl px-4 py-3 text-sm opacity-70 outline-none" style={{ background: c.surf2, border: `1px solid ${c.brd}`, color: c.txt }} />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-sm font-black">Profile Photo</span>
                    <input data-testid="profile-avatar-file" type="file" accept="image/*" onChange={handleAvatarFileChange} className="w-full rounded-2xl px-4 py-3 text-sm outline-none" style={{ background: c.surf2, border: `1px solid ${c.brd}`, color: c.txt }} />
                    <span className="mt-1 block text-xs" style={{ color: c.muted }}>Upload a JPG, PNG or WebP image up to 4MB. The image is stored on Cloudinary.</span>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-sm font-black">Theme</span>
                    <select value={theme} onChange={(event) => handleThemeChange(event.target.value as ThemeMode)} className="w-full rounded-2xl px-4 py-3 text-sm outline-none" style={{ background: c.surf2, border: `1px solid ${c.brd}`, color: c.txt }}>
                      <option value="dark">Dark</option>
                      <option value="light">Light</option>
                    </select>
                  </label>
                </div>

                <div className="mt-6 flex justify-end">
                  <button type="submit" disabled={saving || uploadingAvatar} className="rounded-full px-5 py-3 text-sm font-black text-white disabled:opacity-60" style={{ background: c.acc }}>
                    {saving || uploadingAvatar ? 'Saving…' : 'Save Profile'}
                  </button>
                </div>
              </form>

              <div className="lg:col-span-2">
                <NotificationPreferences />
              </div>

              <AppInstallCard />

              <div className="rounded-[28px] p-5 lg:col-span-2" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
                <h2 className="mb-1 text-xl font-black">Your Data</h2>
                <p className="mb-4 text-sm" style={{ color: c.muted }}>Download a copy of your data or permanently delete your account.</p>
                <div className="flex flex-wrap gap-3">
                  <button onClick={handleExportData} disabled={exportingData} className="rounded-full px-5 py-3 text-sm font-black disabled:opacity-60" style={{ background: c.surf2, border: `1px solid ${c.brd}`, color: c.txt }}>
                    {exportingData ? 'Exporting…' : 'Export My Data'}
                  </button>
                  <button onClick={handleDeleteAccount} disabled={deletingAccount} className="rounded-full px-5 py-3 text-sm font-black text-white disabled:opacity-60" style={{ background: '#ef4444' }}>
                    {deletingAccount ? 'Deleting…' : 'Delete Account'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
