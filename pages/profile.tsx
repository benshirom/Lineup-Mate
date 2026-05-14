import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/lib/AuthContext';
import { getThemeColors, type Language, type ThemeMode } from '@/lib/platform';

type UserRole = 'user' | 'admin';

interface ProfileData {
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  theme: ThemeMode;
  language: Language;
  created_at: string | null;
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, authReady, supabase, language: currentLanguage, theme: currentTheme, setLocalPreferences, refreshProfile, t } = useAuth();
  const c = getThemeColors(currentTheme);

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [theme, setTheme] = useState<ThemeMode>(currentTheme);
  const [language, setLanguage] = useState<Language>(currentLanguage);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
          .select('email, display_name, avatar_url, role, theme, language, created_at')
          .eq('id', user.id)
          .single();

        if (profileError) throw profileError;

        const nextProfile: ProfileData = {
          email: data.email ?? user.email ?? null,
          display_name: data.display_name ?? null,
          avatar_url: data.avatar_url ?? null,
          role: data.role === 'admin' ? 'admin' : 'user',
          theme: data.theme === 'light' ? 'light' : 'dark',
          language: data.language === 'he' ? 'he' : 'en',
          created_at: data.created_at ?? null
        };

        setProfile(nextProfile);
        setDisplayName(nextProfile.display_name || '');
        setAvatarUrl(nextProfile.avatar_url || '');
        setTheme(nextProfile.theme);
        setLanguage(nextProfile.language);
        setLocalPreferences({ theme: nextProfile.theme, language: nextProfile.language });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Could not load your profile.');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [authReady, router, supabase, user]);

  const handleLanguageChange = (nextLanguage: Language) => {
    setLanguage(nextLanguage);
    setLocalPreferences({ language: nextLanguage, theme });
  };

  const handleThemeChange = (nextTheme: ThemeMode) => {
    setTheme(nextTheme);
    setLocalPreferences({ theme: nextTheme, language });
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim() || null,
          avatar_url: avatarUrl.trim() || null,
          theme,
          language
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setProfile((current) => current ? {
        ...current,
        display_name: displayName.trim() || null,
        avatar_url: avatarUrl.trim() || null,
        theme,
        language
      } : current);

      setLocalPreferences({ theme, language });
      await refreshProfile();
      setMessage('Profile saved successfully.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Navbar />
      <main style={{ minHeight: '100vh', background: c.bg, color: c.txt }}>
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
                <div className="mb-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-[28px] text-4xl font-black" style={{ background: `${c.acc}22`, color: c.acc }}>
                  {avatarUrl ? <img src={avatarUrl} alt="Profile avatar" className="h-full w-full object-cover" /> : (displayName || profile.email || 'U').slice(0, 1).toUpperCase()}
                </div>
                <h2 className="text-xl font-black">{displayName || profile.email || 'User'}</h2>
                <p className="mt-1 text-sm" style={{ color: c.muted }}>{profile.email}</p>
                <div className="mt-4 space-y-2 text-sm" style={{ color: c.muted }}>
                  <div><b style={{ color: c.txt }}>Account type:</b> {profile.role}</div>
                  <div><b style={{ color: c.txt }}>Language:</b> {language.toUpperCase()}</div>
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
                    <span className="mb-1 block text-sm font-black">Avatar URL</span>
                    <input value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} placeholder="https://..." className="w-full rounded-2xl px-4 py-3 text-sm outline-none" style={{ background: c.surf2, border: `1px solid ${c.brd}`, color: c.txt }} />
                  </label>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-sm font-black">Theme</span>
                      <select value={theme} onChange={(event) => handleThemeChange(event.target.value as ThemeMode)} className="w-full rounded-2xl px-4 py-3 text-sm outline-none" style={{ background: c.surf2, border: `1px solid ${c.brd}`, color: c.txt }}>
                        <option value="dark">Dark</option>
                        <option value="light">Light</option>
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-sm font-black">Language</span>
                      <select value={language} onChange={(event) => handleLanguageChange(event.target.value as Language)} className="w-full rounded-2xl px-4 py-3 text-sm outline-none" style={{ background: c.surf2, border: `1px solid ${c.brd}`, color: c.txt }}>
                        <option value="en">English</option>
                        <option value="he">Hebrew</option>
                      </select>
                    </label>
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button type="submit" disabled={saving} className="rounded-full px-5 py-3 text-sm font-black text-white disabled:opacity-60" style={{ background: c.acc }}>
                    {saving ? 'Saving…' : 'Save Profile'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
