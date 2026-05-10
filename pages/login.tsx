import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
import Navbar from '@/components/Navbar';

function getFriendlyAuthError(message: string) {
  const lower = message.toLowerCase();

  if (lower.includes('email not confirmed')) {
    return 'Your account was created, but the email is not confirmed yet. Check your inbox or ask the admin to confirm it in Supabase.';
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

  useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  const isEmailValid = useMemo(() => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }, [email]);

  const isPasswordValid = password.length >= 6;

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
        const { data, error } = await supabase.auth.signUp({ email: cleanEmail, password });
        if (error) throw error;

        if (data.user && !data.session) {
          setMessage('Account created. Please confirm your email before logging in.');
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
                disabled={submitting}
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