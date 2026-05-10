import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
import Navbar from '@/components/Navbar';

type SocialProvider = 'google';

function getFriendlyAuthError(message: string) {
  const lower = message.toLowerCase();

  if (lower.includes('email not confirmed')) {
    return 'Your account exists, but the email is not confirmed yet. Open your inbox and click the confirmation link from Supabase / Lineup-Mate.';
  }

  if (lower.includes('rate limit') || lower.includes('too many')) {
    return 'Too many signup attempts were made. Please wait a few minutes before trying again.';
  }

  if (lower.includes('email address') && lower.includes('invalid')) {
    return 'This email address was rejected by Supabase. Try a different valid email address.';
  }

  if (lower.includes('invalid login credentials')) {
    return 'Incorrect email or password.';
  }

  if (lower.includes('provider') && lower.includes('not enabled')) {
    return 'Google login is not enabled yet in Supabase. Enable it in Authentication → Providers → Google.';
  }

  return message;
}

const LoginPage = () => {
  const { user, supabase } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLogin, setIsLogin] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(null);

  useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  const isEmailValid = useMemo(() => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }, [email]);

  const isPasswordValid = password.length >= 6;

  const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/` : undefined;

  const handleSocialLogin = async (provider: SocialProvider) => {
    setError(null);
    setMessage(null);
    setSocialLoading(provider);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          }
        }
      });

      if (error) throw error;
    } catch (err: unknown) {
      const rawMessage = err instanceof Error ? err.message : 'Social login failed.';
      setError(getFriendlyAuthError(rawMessage));
      setSocialLoading(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const cleanEmail = email.trim().toLowerCase();

    if (!isEmailValid) {
      setError('Enter a valid email address.');
      return;
    }

    if (!isPasswordValid) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            emailRedirectTo: redirectTo
          }
        });
        if (error) throw error;

        if (data.user && !data.session) {
          setMessage('Account created. We sent a confirmation link to your email. Open your inbox, confirm the account, then log in.');
          setIsLogin(true);
        } else {
          setMessage('Account created successfully.');
        }
      }
    } catch (err: unknown) {
      const rawMessage = err instanceof Error ? err.message : 'Authentication failed.';
      setError(getFriendlyAuthError(rawMessage));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
        <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4 w-full max-w-md">
          <h1 className="text-2xl font-bold mb-4 text-center">
            {isLogin ? 'Login' : 'Create an Account'}
          </h1>
          {message && <p className="text-green-700 bg-green-50 border border-green-200 rounded p-3 mb-4 text-sm">{message}</p>}
          {error && <p className="text-red-700 bg-red-50 border border-red-200 rounded p-3 mb-4 text-sm">{error}</p>}

          <div className="grid grid-cols-1 gap-3 mb-5">
            <button
              type="button"
              disabled={socialLoading !== null || submitting}
              onClick={() => handleSocialLogin('google')}
              className="w-full border border-gray-300 rounded py-2 px-4 font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              {socialLoading === 'google' ? 'Redirecting…' : 'Continue with Google'}
            </button>
          </div>

          <div className="flex items-center gap-3 mb-5">
            <div className="h-px bg-gray-200 flex-1" />
            <span className="text-xs text-gray-500">or use email</span>
            <div className="h-px bg-gray-200 flex-1" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring"
              />
            </div>
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring"
              />
              {!isLogin && <p className="mt-1 text-xs text-gray-500">Use at least 6 characters.</p>}
            </div>
            <div className="flex items-center justify-between gap-3">
              <button
                type="submit"
                disabled={submitting || socialLoading !== null}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:ring disabled:opacity-60"
              >
                {submitting ? 'Please wait…' : isLogin ? 'Login' : 'Sign Up'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError(null);
                  setMessage(null);
                }}
                className="text-sm text-blue-500 hover:text-blue-700"
              >
                {isLogin ? 'Create an account' : 'Already have an account?'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default LoginPage;
