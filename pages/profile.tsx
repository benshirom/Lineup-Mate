import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Navbar from '@/components/Navbar';
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

export default function ProfilePage() {
  const router = useRouter();
  const { user, session, authReady, supabase, theme: currentTheme, setLocalPreferences, refreshProfile, t } = useAuth();
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

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const uploadedAvatarUrl = await uploadAvatarIfNeeded();

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim() || null,
          avatar_url: uploadedAvatarUrl,
          theme
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
        theme
      } : current);

      await refreshProfile();
      setLocalPreferences({ theme });
      setMessage('Profile saved successfully.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = { background: c.surfaceHover, border: `1px solid ${c.border}`, color: c.txt };

  return (
    <>
      <Navbar />
      <main className="mobile-shell-padding" style={{ minHeight: '100vh', background: c.bg, color: c.txt }}>
        <section className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-10">
          <header className="premium-card mb-6 p-5 sm:p-6">
            <div className="relative z-10">
              <p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: c.primary }}>{t.appName}</p>
              <h1 className="app-title mt-2 text-4xl font-black leading-tight sm:text-5xl">{t.navProfile}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6" style={{ color: c.textSecondary }}>Manage your display name, avatar and account preferences.</p>
            </div>
          </header>

          {(!authReady || loading) && <p style={{ color: c.muted }}>Loading profile…</p>}
          {error && <p className="mb-4 rounded-2xl p-4 text-sm font-bold" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.26)', color: c.danger }}>{error}</p>}
          {message && <p className="mb-4 rounded-2xl p-4 text-sm font-bold" style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.26)', color: c.success }}>{message}</p>}

          {authReady && !loading && profile && (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_1fr]">
              <aside className="premium-card p-5">
                <div className="relative z-10">
                  <div data-testid="profile-avatar-preview" className="mb-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-[28px] text-4xl font-black" style={{ background: c.primarySoft, color: c.primary, border: `1px solid rgba(139,92,246,0.26)` }}>
                    {avatarPreview ? <img src={avatarPreview} alt="Profile avatar" className="h-full w-full object-cover" /> : (displayName || profile.email || 'U').slice(0, 1).toUpperCase()}
                  </div>
                  <h2 className="app-title text-2xl font-black">{displayName || profile.email || 'User'}</h2>
                  <p className="mt-1 truncate text-sm" style={{ color: c.muted }}>{profile.email}</p>
                  <div className="mt-5 space-y-2 text-sm" style={{ color: c.muted }}>
                    <div><b style={{ color: c.txt }}>Account type:</b> {profile.role}</div>
                    <div><b style={{ color: c.txt }}>Theme:</b> {theme}</div>
                    {profile.created_at && <div><b style={{ color: c.txt }}>Joined:</b> {new Date(profile.created_at).toLocaleDateString()}</div>}
                  </div>
                </div>
              </aside>

              <form onSubmit={handleSave} className="premium-card p-5 sm:p-6">
                <div className="relative z-10">
                  <h2 className="app-title mb-5 text-2xl font-black">Account details</h2>

                  <div className="space-y-4">
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.14em]" style={{ color: c.muted }}>Display Name</span>
                      <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Your display name" className="mobile-action w-full rounded-2xl px-4 py-3 text-sm outline-none" style={inputStyle} />
                    </label>

                    <label className="block">
                      <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.14em]" style={{ color: c.muted }}>Email</span>
                      <input value={profile.email || ''} disabled className="mobile-action w-full rounded-2xl px-4 py-3 text-sm opacity-70 outline-none" style={inputStyle} />
                    </label>

                    <label className="block">
                      <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.14em]" style={{ color: c.muted }}>Profile Photo</span>
                      <input data-testid="profile-avatar-file" type="file" accept="image/*" onChange={handleAvatarFileChange} className="mobile-action w-full rounded-2xl px-4 py-3 text-sm outline-none" style={inputStyle} />
                      <span className="mt-1.5 block text-xs leading-5" style={{ color: c.muted }}>Upload a JPG, PNG or WebP image up to 4MB. The image is stored on Cloudinary.</span>
                    </label>

                    <label className="block">
                      <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.14em]" style={{ color: c.muted }}>Theme</span>
                      <select value={theme} onChange={(event) => handleThemeChange(event.target.value as ThemeMode)} className="mobile-action w-full rounded-2xl px-4 py-3 text-sm outline-none" style={inputStyle}>
                        <option value="dark">Dark</option>
                        <option value="light">Light</option>
                      </select>
                    </label>
                  </div>

                  <div className="mt-6 flex justify-end">
                    <button type="submit" disabled={saving || uploadingAvatar} className="mobile-action w-full rounded-2xl px-5 py-3 text-sm font-black text-white shadow-lg disabled:opacity-60 sm:w-auto" style={{ background: `linear-gradient(135deg, ${c.primary}, ${c.secondary})`, boxShadow: c.glow }}>
                      {saving || uploadingAvatar ? 'Saving…' : 'Save Profile'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
