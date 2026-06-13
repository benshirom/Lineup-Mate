import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '@/lib/AuthContext';
import Navbar from '@/components/Navbar';
import { getThemeColors } from '@/lib/platform';

function isNativePlatform(platform: string): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Capacitor } = require('@capacitor/core');
    return Capacitor.getPlatform() === platform;
  } catch {
    return false;
  }
}

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
  const [appleLoading, setAppleLoading] = useState(false);
  const showAppleButton = isNativePlatform('ios');

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
    if (user && view !== 'update-password') {
      const rt = router.query.returnTo;
      const returnTo =
        typeof rt === 'string' && rt.startsWith('/') && !rt.startsWith('//')
          ? rt
          : '/';
      router.push(returnTo);
    }
  }, [user, router, view]);


  const isEmailValid = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()), [email]);
  const isPasswordValid = password.length >= 6;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? (typeof window !== 'undefined' ? window.location.origin : '');
  const redirectTo = appUrl ? `${appUrl}/login?type=recovery` : undefined;
  const authRedirectTo = appUrl ? `${appUrl}/` : undefined;

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

  const handleAppleSignIn = async () => {
    reset();
    setAppleLoading(true);
    try {
      const { SignInWithApple } = await import('@capacitor-community/apple-sign-in');
      const result = await SignInWithApple.authorize({
        clientId: process.env.NEXT_PUBLIC_APPLE_CLIENT_ID ?? 'com.lineupmate.app',
        redirectURI: authRedirectTo ?? '/',
        scopes: 'email name',
      });
      const identityToken = result?.response?.identityToken;
      if (!identityToken) throw new Error('No identity token from Apple');
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: identityToken,
      });
      if (error) throw error;
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('user cancel')) {
        // User cancelled — no error to show
      } else {
        setError(getFriendlyAuthError(err instanceof Error ? err.message : 'Apple login failed.'));
      }
    } finally {
      setAppleLoading(false);
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

  const inputClass = 'w-full rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 transition';
  const inputStyle = { background: c.surf2, border: `1px solid ${c.brd}`, color: c.txt };

  const titles: Record<View, string> = {
    login: 'Welcome back',
    signup: 'Create your lineup account',
    forgot: 'Reset your password',
    'update-password': 'Choose a new password'
  };

  return (
    <>
      <Head><title>Sign in — Lineup Mate</title></Head>
      <Navbar />
      <main id="main-content" style={{ minHeight: '100dvh', background: c.bg, color: c.txt }} className="mobile-shell-padding flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md rounded-[28px] p-8 shadow-2xl" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
          <div className="mb-1 text-xs font-extrabold uppercase tracking-widest" style={{ color: c.acc }}>Lineup·Mate</div>
          <h1 className="mb-6 text-3xl font-black">{titles[view]}</h1>

          {message && <div className="mb-4 rounded-2xl p-3 text-sm font-bold" style={{ background: '#16a34a20', color: '#16a34a', border: '1px solid #16a34a40' }}>{message}</div>}
          {error && <div className="mb-4 rounded-2xl p-3 text-sm font-bold" style={{ background: '#dc262620', color: '#ef4444', border: '1px solid #dc262640' }}>{error}</div>}

          {view !== 'forgot' && view !== 'update-password' && (
            <>
              <button type="button" disabled={socialLoading !== null || submitting || appleLoading} onClick={() => handleSocialLogin('google')} className="mb-3 w-full rounded-2xl px-4 py-3 text-sm font-bold transition hover:opacity-80 disabled:opacity-50" style={{ background: c.surf2, border: `1px solid ${c.brd}`, color: c.txt }}>
                {socialLoading === 'google' ? 'Redirecting…' : '🌐  Continue with Google'}
              </button>
              {showAppleButton && (
                <button type="button" disabled={appleLoading || socialLoading !== null || submitting} onClick={handleAppleSignIn} className="mb-4 w-full rounded-2xl px-4 py-3 text-sm font-bold transition hover:opacity-80 disabled:opacity-50" style={{ background: '#000', border: '1px solid #333', color: '#fff' }}>
                  {appleLoading ? 'Redirecting…' : '🍎  Continue with Apple'}
                </button>
              )}
              <div className="mb-4 flex items-center gap-3">
                <div className="h-px flex-1" style={{ background: c.brd }} />
                <span className="text-xs" style={{ color: c.muted }}>or use email</span>
                <div className="h-px flex-1" style={{ background: c.brd }} />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {view === 'signup' && (
              <div>
                <label htmlFor="display-name" className="mb-1.5 block text-xs font-extrabold uppercase tracking-widest" style={{ color: c.muted }}>Display name</label>
                <input id="display-name" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="How should friends see you?" autoComplete="name" className={inputClass} style={inputStyle} />
              </div>
            )}

            {view !== 'update-password' && (
              <div>
                <label htmlFor="email" className="mb-1.5 block text-xs font-extrabold uppercase tracking-widest" style={{ color: c.muted }}>Email</label>
                <input id="email" type="text" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={inputClass} style={inputStyle} />
              </div>
            )}

            {view !== 'forgot' && (
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="password" className="text-xs font-extrabold uppercase tracking-widest" style={{ color: c.muted }}>
                    {view === 'update-password' ? 'New Password' : 'Password'}
                  </label>
                  {view === 'login' && <button type="button" onClick={() => { reset(); setView('forgot'); }} className="text-xs font-bold hover:opacity-80" style={{ color: c.acc }}>Forgot password?</button>}
                </div>
                <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete={view === 'login' ? 'current-password' : 'new-password'} className={inputClass} style={inputStyle} />
                {(view === 'signup' || view === 'update-password') && <p className="mt-1 text-xs" style={{ color: c.muted }}>At least 6 characters.</p>}
              </div>
            )}

            {view === 'update-password' && (
              <div>
                <label htmlFor="confirm-password" className="mb-1.5 block text-xs font-extrabold uppercase tracking-widest" style={{ color: c.muted }}>Confirm Password</label>
                <input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required autoComplete="new-password" className={inputClass} style={inputStyle} />
              </div>
            )}

            <button type="submit" disabled={submitting || socialLoading !== null} className="w-full rounded-2xl px-4 py-3 text-sm font-black text-white disabled:opacity-50" style={{ background: c.accHover }}>
              {submitting ? 'Please wait…' : view === 'login' ? 'Sign in' : view === 'signup' ? 'Create account' : view === 'forgot' ? 'Send reset link' : 'Update password'}
            </button>
          </form>

          <div className="mt-5 flex flex-col gap-2 text-center text-sm">
            {view === 'login' && <button type="button" onClick={() => { reset(); setView('signup'); }} className="font-bold hover:opacity-80" style={{ color: c.acc }}>No account yet? Sign up</button>}
            {view === 'signup' && <button type="button" onClick={() => { reset(); setView('login'); }} className="font-bold hover:opacity-80" style={{ color: c.acc }}>Already have an account? Sign in</button>}
            {(view === 'forgot' || view === 'update-password') && <button type="button" onClick={() => { reset(); setView('login'); }} className="font-bold hover:opacity-80" style={{ color: c.muted }}>← Back to sign in</button>}
          </div>
        </div>
      </main>
    </>
  );
};

export default LoginPage;
