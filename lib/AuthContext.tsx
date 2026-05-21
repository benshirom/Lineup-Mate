import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import supabase from './supabaseClient';
import { translations, type ThemeMode } from './platform';

type TranslationSet = typeof translations;

interface UserProfile {
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role: 'user' | 'admin';
  theme: ThemeMode;
}

interface AuthContextProps {
  user: User | null;
  session: Session | null;
  authReady: boolean;
  profile: UserProfile | null;
  theme: ThemeMode;
  t: TranslationSet;
  supabase: typeof supabase;
  refreshProfile: () => Promise<void>;
  setLocalPreferences: (next: Partial<Pick<UserProfile, 'theme'>>) => void;
}

const DEFAULT_THEME: ThemeMode = 'dark';

const AuthContext = createContext<AuthContextProps>({
  user: null,
  session: null,
  authReady: false,
  profile: null,
  theme: DEFAULT_THEME,
  t: translations,
  supabase,
  refreshProfile: async () => undefined,
  setLocalPreferences: () => undefined
});

function normalizeTheme(value: unknown): ThemeMode {
  return value === 'light' ? 'light' : 'dark';
}

function readStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  return normalizeTheme(window.localStorage.getItem('lineup-mate-theme'));
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [theme, setTheme] = useState<ThemeMode>(() => readStoredTheme());

  const applyPreferences = useCallback((nextTheme: ThemeMode) => {
    setTheme(nextTheme);

    if (typeof document !== 'undefined') {
      document.documentElement.lang = 'en';
      document.documentElement.dir = 'ltr';
      document.documentElement.dataset.theme = nextTheme;
    }

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('lineup-mate-language');
      window.localStorage.setItem('lineup-mate-theme', nextTheme);
    }
  }, []);

  const loadProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('email, display_name, avatar_url, role, theme')
      .eq('id', userId)
      .single();

    const storedTheme = readStoredTheme();
    const profileTheme = data?.theme ? normalizeTheme(data.theme) : null;
    const nextTheme = profileTheme ?? storedTheme;

    if (data) {
      setProfile({
        email: data.email ?? null,
        display_name: data.display_name ?? null,
        avatar_url: data.avatar_url ?? null,
        role: data.role === 'admin' ? 'admin' : 'user',
        theme: nextTheme
      });
    } else {
      setProfile(null);
    }

    applyPreferences(nextTheme);
  }, [applyPreferences]);

  const refreshProfile = useCallback(async () => {
    if (user?.id) await loadProfile(user.id);
  }, [loadProfile, user?.id]);

  const setLocalPreferences = useCallback((next: Partial<Pick<UserProfile, 'theme'>>) => {
    const nextTheme = normalizeTheme(next.theme ?? readStoredTheme());
    applyPreferences(nextTheme);
    setProfile((current) => current ? { ...current, theme: nextTheme } : current);
  }, [applyPreferences]);

  useEffect(() => {
    applyPreferences(readStoredTheme());

    const setData = async () => {
      try {
        const {
          data: { session }
        } = await supabase.auth.getSession();

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          await loadProfile(session.user.id);
        } else {
          setProfile(null);
        }
      } finally {
        setAuthReady(true);
      }
    };
    setData();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthReady(true);
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
        applyPreferences(DEFAULT_THEME);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [applyPreferences, loadProfile]);

  const value: AuthContextProps = {
    user,
    session,
    authReady,
    profile,
    theme,
    t: translations,
    supabase,
    refreshProfile,
    setLocalPreferences
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  return useContext(AuthContext);
};