import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import * as Sentry from '@sentry/nextjs';
import supabase from './supabaseClient';
import { translations, type ThemeMode } from './platform';
import { storage, sessionStore } from './storage';

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
  return normalizeTheme(storage.get('lineup-mate-theme'));
}

interface AuthProviderProps {
  children: React.ReactNode;
  onNavigate?: (path: string) => void;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children, onNavigate }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [theme, setTheme] = useState<ThemeMode>(() => readStoredTheme());
  const pendingInviteHandled = useRef(false);

  const navigate = useCallback((path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else if (typeof window !== 'undefined') {
      window.location.href = path;
    }
  }, [onNavigate]);

  const applyPreferences = useCallback((nextTheme: ThemeMode) => {
    setTheme(nextTheme);

    if (typeof document !== 'undefined') {
      document.documentElement.lang = 'en';
      document.documentElement.dir = 'ltr';
      document.documentElement.dataset.theme = nextTheme;
    }

    storage.remove('lineup-mate-language');
    storage.set('lineup-mate-theme', nextTheme);
  }, []);

  const loadProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('email, display_name, avatar_url, role, theme, is_blocked')
      .eq('id', userId)
      .single();

    if (data?.is_blocked) {
      await supabase.auth.signOut();
      navigate('/blocked');
      return;
    }

    const profileTheme = data?.theme ? normalizeTheme(data.theme) : null;
    const nextTheme = profileTheme ?? readStoredTheme();

    if (data) {
      setProfile({
        email: data.email ?? null,
        display_name: data.display_name ?? null,
        avatar_url: data.avatar_url ?? null,
        role: data.role === 'admin' ? 'admin' : 'user',
        theme: nextTheme
      });
      Sentry.setUser({ id: userId });
    } else {
      setProfile(null);
    }

    applyPreferences(nextTheme);
  }, [applyPreferences, navigate]);

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

    let cancelled = false;
    const setData = async () => {
      try {
        const {
          data: { session }
        } = await supabase.auth.getSession();

        if (cancelled) return;
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          await loadProfile(session.user.id);
        } else {
          if (!cancelled) setProfile(null);
        }
      } finally {
        if (!cancelled) setAuthReady(true);
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
        // Handle pending invite code from join page
        if (!pendingInviteHandled.current) {
          const pendingCode = sessionStore.get('pendingInviteCode');
          if (pendingCode) {
            pendingInviteHandled.current = true;
            sessionStore.remove('pendingInviteCode');
            supabase
              .rpc('join_group_by_invite_code', { p_invite_code: pendingCode.toLowerCase() })
              .then(({ data: groupId, error }) => {
                if (!error && groupId) {
                  navigate(`/group/${groupId}?welcome=1`);
                }
              });
          }
        }
      } else {
        setProfile(null);
        applyPreferences(DEFAULT_THEME);
        pendingInviteHandled.current = false;
        Sentry.setUser(null);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [applyPreferences, loadProfile, navigate]);

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
