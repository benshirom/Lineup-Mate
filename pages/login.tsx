import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
import Navbar from '@/components/Navbar';
import { getThemeColors } from '@/lib/platform';

type SocialProvider = 'google';
type View = 'login' | 'signup' | 'forgot' | 'update-password';

function getFriendlyAuthError(message: string) {
  const lower = message.toLowerCase();

  if (lower.includes('email not confirmed')) {
    return 'Your account exists, but the email is not confirmed yet. Open your inbox and click the confirmation link.';
  }
  if (lower.includes('rate limit') || lower.includes('too many')) {
    return 'Too many attempts. Please wait a few minutes before trying again.';
  }
  if (lower.includes('email address') && lower.includes('invalid')) {
    return 'This email address is invalid. Try a different one.';
  }
  if (lower.includes('invalid login credentials')) {
    return 'Incorrect email or password.';
  }
  if (lower.includes('provider') && lower.includes('not enabled')) {
    return 'Google login is not enabled yet. Enable it in Authentication → Providers → Google.';
  }
  return message;
}

const LoginPage = () => {
  const { user, supabase, theme } = useAuth();
  const router = useRouter();
  const c = getThemeColors(theme);

  const [view, setView] = useState<View>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const queryType = typeof router.query.type === 'string' ? router.query.type : '';
    const hashType = hashParams.get('type') || '';

    if (queryType === 'recovery' || hashType === 'recovery') {
      setView('update-password');
      setMessage('Choose a new password for your account.');
    }
  }, [router.query.type]);

  useEffect(() => {
    if (user && view !== 'update-password') router.push('/');
  }, [user, router, view]);

  const isEmailValid = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()), [email]);
  const isPasswordValid = password.length >= 6;

  const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/login?type=recovery` : undefined;
  const authRedirectTo = typeof window !== 'undefined' ? `${window.location.origin}/` : undefined;

  const reset = () => {
    setError(null);
    setMessage(null);
  };

  const handleSocialLogin = async (provider: SocialProvider) => {
    reset();
    setSocialLoading(provider);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: authRedirectTo, queryParams: { access_type: 'offline', prompt: 'consent' } }
      });
      if (error) throw error;
    } catch (err: unknown) {
      setError(getFriendlyAuthError(err instanceof Error ? err.message : 'Social login failed.'));
      setSocialLoading(null);
    }
  };

  const handleUpdatePassword = async () => {
    if (!isPasswordValid) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }

    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setMessage('Password updated successfully. You can now continue to the app.');
      setPassword('');
      setConfirmPassword('');
      setTimeout(() => router.push('/'), 900);
    } catch (err: unknown) {
      setError(getFriendlyAuthError(err instanceof Error ? err.message : 'Could not update password.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    reset();

    if (view === 'update-password') {
      await handleUpdatePassword();
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!isEmailValid) { setError('Enter a valid email address.'); return; }

    if (view === 'forgot') {
      setSubmitting(true);
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo });
        if (error) throw error;
        setMessage('Password reset link sent. Check your inbox and open the link to choose a new password.');
        setView('login');
      } catch (err: unknown) {
        setError(getFriendlyAuthError(err instanceof Error ? err.message : 'Failed to send reset email.'));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!isPasswordValid) { setError('Password must be at least 6 characters.'); return; }

    setSubmitting(true);
    try {
      if (view === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (error) throw error;
      } else {
        const name = displayName.trim() || cleanEmail.split('@')[0];
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            emailRedirectTo: authRedirectTo,
            data: { display_name: name }
          }
        });
        if (error) throw error;
        if (data.user && !data.session) {
          setMessage('Account created! We sent a confirmation link to your email. Confirm it, then log in.');
          setView('login');
        } else {
          setMessage('Account created successfully.');
        }
      }
    } catch (err: unknown) {
      setError(getFriendlyAuthError(err instanceof Error ? err.message : 'Authentication failed.'));
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = 'mobile-action w-full rounded-2xl px-4 py-3 text-sm outline-none transition';
  const inputStyle = { background: c.surfaceHover, border: `1px solid ${c.border}`, color: c.txt };

  const titles: Record<View, string> = {
    login: 'Welcome back',
    signup: 'Create your lineup account',
    forgot: 'Reset your password',
    'update-password': 'Choose a new password'
  };

  return (
    <>
      <Navbar />
      <main style={{ minHeight: '100vh', background: c.bg, color: c.txt }} className="mobile-shell-padding px-4 py-8 md:px-6 md:py-12">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <section className="premium-card order-2 hidden p-6 lg:block">
            <div className="relative z-10">
              <div className="mb-8 inline-flex rounded-full px-3 py-1.5 text-xs font-black" style={{ background: c.primarySoft, color: c.primary, border: '1px solid rgba(139,92,246,0.28)' }}>
                Personal + group planning
              </div>
              <h2 className="app-title max-w-md text-5xl font-black leading-none">Build the schedule you will actually use.</h2>
              <p className="mt-4 max-w-md text-base leading-7" style={{ color: c.textSecondary }}>
                Save artists, avoid overlaps and coordinate where your friends are going before the festival starts.
              </p>

              <div className="mt-8 space-y-3 rounded-[28px] p-4" style={{ background: c.surfaceHover, border: `1px solid ${c.border}` }}>
                {[
                  ['22:30', 'Ace Ventura', 'Main Stage', 'Going'],
                  ['00:00', 'Astrix', 'Dance Temple', 'Friends going'],
                  ['01:30', 'Time conflict', 'Choose one set', 'Conflict']
                ].map(([time, title, meta, status]) => (
                  <div key={`${time}-${title}`} className="flex items-center gap-3 rounded-2xl p-3" style={{ background: c.surface }}>
                    <div className="w-12 text-xs font-black" style={{ color: c.secondary }}>{time}</div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-black">{title}</div>
                      <div className="truncate text-xs" style={{ color: c.muted }}>{meta}</div>
                    </div>
                    <span className="rounded-full px-2.5 py-1 text-[10px] font-black" style={{ background: status === 'Conflict' ? 'rgba(239,68,68,0.12)' : c.primarySoft, color: status === 'Conflict' ? c.danger : c.primary }}>
                      {status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="order-1 mx-auto w-full max-w-md lg:order-1">
            <div className="premium-card p-6 sm:p-8">
              <div className="relative z-10">
                <div className="mb-2 text-xs font-black uppercase tracking-[0.16em]" style={{ color: c.primary }}>Lineup·Mate</div>
                <h1 className="app-title mb-2 text-3xl font-black leading-tight">{titles[view]}</h1>
                <p className="mb-6 text-sm leading-6" style={{ color: c.muted }}>
                  Sign in to save artists, create groups and keep your festival plan synced.
                </p>

                {message && <div className="mb-4 rounded-2xl p-3 text-sm font-bold" style={{ background: 'rgba(34,197,94,0.12)', color: c.success, border: '1px solid rgba(34,197,94,0.26)' }}>{message}</div>}
                {error && <div className="mb-4 rounded-2xl p-3 text-sm font-bold" style={{ background: 'rgba(239,68,68,0.12)', color: c.danger, border: '1px solid rgba(239,68,68,0.26)' }}>{error}</div>}

                {view !== 'forgot' && view !== 'update-password' && (
                  <>
                    <button type="button" disabled={socialLoading !== null || submitting} onClick={() => handleSocialLogin('google')} className="mobile-action mb-4 w-full rounded-2xl px-4 py-3 text-sm font-black transition hover:opacity-90 disabled:opacity-50" style={{ background: c.surfaceHover, border: `1px solid ${c.border}`, color: c.txt }}>
                      {socialLoading === 'google' ? 'Redirecting…' : 'Continue with Google'}
                    </button>
                    <div className="mb-4 flex items-center gap-3">
                      <div className="h-px flex-1" style={{ background: c.border }} />
                      <span className="text-xs" style={{ color: c.muted }}>or use email</span>
                      <div className="h-px flex-1" style={{ background: c.border }} />
                    </div>
                  </>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {view === 'signup' && (
                    <div>
                      <label htmlFor="display-name" className="mb-1.5 block text-xs font-black uppercase tracking-[0.14em]" style={{ color: c.muted }}>Display name</label>
                      <input id="display-name" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="How should friends see you?" autoComplete="name" className={inputClass} style={inputStyle} />
                    </div>
                  )}

                  {view !== 'update-password' && (
                    <div>
                      <label htmlFor="email" className="mb-1.5 block text-xs font-black uppercase tracking-[0.14em]" style={{ color: c.muted }}>Email</label>
                      <input id="email" type="text" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={inputClass} style={inputStyle} />
                    </div>
                  )}

                  {view !== 'forgot' && (
                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <label htmlFor="password" className="text-xs font-black uppercase tracking-[0.14em]" style={{ color: c.muted }}>
                          {view === 'update-password' ? 'New Password' : 'Password'}
                        </label>
                        {view === 'login' && <button type="button" onClick={() => { reset(); setView('forgot'); }} className="text-xs font-bold hover:opacity-80" style={{ color: c.primary }}>Forgot password?</button>}
                      </div>
                      <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete={view === 'login' ? 'current-password' : 'new-password'} className={inputClass} style={inputStyle} />
                      {(view === 'signup' || view === 'update-password') && <p className="mt-1 text-xs" style={{ color: c.muted }}>At least 6 characters.</p>}
                    </div>
                  )}

                  {view === 'update-password' && (
                    <div>
                      <label htmlFor="confirm-password" className="mb-1.5 block text-xs font-black uppercase tracking-[0.14em]" style={{ color: c.muted }}>Confirm Password</label>
                      <input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required autoComplete="new-password" className={inputClass} style={inputStyle} />
                    </div>
                  )}

                  <button type="submit" disabled={submitting || socialLoading !== null} className="mobile-action w-full rounded-2xl px-4 py-3 text-sm font-black text-white shadow-lg disabled:opacity-50" style={{ background: `linear-gradient(135deg, ${c.primary}, ${c.secondary})`, boxShadow: c.glow }}>
                    {submitting ? 'Please wait…' : view === 'login' ? 'Sign in' : view === 'signup' ? 'Create account' : view === 'forgot' ? 'Send reset link' : 'Update password'}
                  </button>
                </form>

                <div className="mt-5 flex flex-col gap-2 text-center text-sm">
                  {view === 'login' && <button type="button" onClick={() => { reset(); setView('signup'); }} className="font-bold hover:opacity-80" style={{ color: c.primary }}>No account yet? Sign up</button>}
                  {view === 'signup' && <button type="button" onClick={() => { reset(); setView('login'); }} className="font-bold hover:opacity-80" style={{ color: c.primary }}>Already have an account? Sign in</button>}
                  {(view === 'forgot' || view === 'update-password') && <button type="button" onClick={() => { reset(); setView('login'); }} className="font-bold hover:opacity-80" style={{ color: c.muted }}>Back to sign in</button>}
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
};

export default LoginPage;
