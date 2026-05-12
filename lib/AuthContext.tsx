import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import supabase from './supabaseClient';
import { translations, type Language, type ThemeMode } from './platform';

type TranslationSet = (typeof translations)[Language];

interface UserProfile {
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role: 'user' | 'admin';
  theme: ThemeMode;
  language: Language;
}

interface AuthContextProps {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  language: Language;
  theme: ThemeMode;
  t: TranslationSet;
  supabase: typeof supabase;
  refreshProfile: () => Promise<void>;
  setLocalPreferences: (next: Partial<Pick<UserProfile, 'language' | 'theme'>>) => void;
}

const DEFAULT_LANGUAGE: Language = 'en';
const DEFAULT_THEME: ThemeMode = 'dark';

const AuthContext = createContext<AuthContextProps>({
  user: null,
  session: null,
  profile: null,
  language: DEFAULT_LANGUAGE,
  theme: DEFAULT_THEME,
  t: translations[DEFAULT_LANGUAGE],
  supabase,
  refreshProfile: async () => undefined,
  setLocalPreferences: () => undefined
});

function normalizeLanguage(value: unknown): Language {
  return value === 'he' ? 'he' : 'en';
}

function normalizeTheme(value: unknown): ThemeMode {
  return value === 'light' ? 'light' : 'dark';
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [language, setLanguage] = useState<Language>(DEFAULT_LANGUAGE);
  const [theme, setTheme] = useState<ThemeMode>(DEFAULT_THEME);

  const applyPreferences = (nextLanguage: Language, nextTheme: ThemeMode) => {
    setLanguage(nextLanguage);
    setTheme(nextTheme);

    if (typeof document !== 'undefined') {
      document.documentElement.lang = nextLanguage;
      document.documentElement.dir = nextLanguage === 'he' ? 'rtl' : 'ltr';
      document.documentElement.dataset.theme = nextTheme;
    }

    if (typeof window !== 'undefined') {
      window.localStorage.setItem('lineup-mate-language', nextLanguage);
      window.localStorage.setItem('lineup-mate-theme', nextTheme);
    }
  };

  const loadProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('email, display_name, avatar_url, role, theme, language')
      .eq('id', userId)
      .single();

    const nextLanguage = normalizeLanguage(data?.language);
    const nextTheme = normalizeTheme(data?.theme);

    if (data) {
      setProfile({
        email: data.email ?? null,
        display_name: data.display_name ?? null,
        avatar_url: data.avatar_url ?? null,
        role: data.role === 'admin' ? 'admin' : 'user',
        theme: nextTheme,
        language: nextLanguage
      });
    }

    applyPreferences(nextLanguage, nextTheme);
  };

  const refreshProfile = async () => {
    if (user?.id) await loadProfile(user.id);
  };

  const setLocalPreferences = (next: Partial<Pick<UserProfile, 'language' | 'theme'>>) => {
    const nextLanguage = normalizeLanguage(next.language ?? language);
    const nextTheme = normalizeTheme(next.theme ?? theme);
    applyPreferences(nextLanguage, nextTheme);
    setProfile((current) => current ? { ...current, language: nextLanguage, theme: nextTheme } : current);
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      applyPreferences(
        normalizeLanguage(window.localStorage.getItem('lineup-mate-language')),
        normalizeTheme(window.localStorage.getItem('lineup-mate-theme'))
      );
    }

    const setData = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) await loadProfile(session.user.id);
    };
    setData();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const value: AuthContextProps = {
    user,
    session,
    profile,
    language,
    theme,
    t: translations[language],
    supabase,
    refreshProfile,
    setLocalPreferences
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  return useContext(AuthContext);
};
