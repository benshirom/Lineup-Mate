import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import supabase from './supabaseClient';

interface AuthContextProps {
  user: User | null;
  session: Session | null;
  supabase: typeof supabase;
}

const AuthContext = createContext<AuthContextProps>({
  user: null,
  session: null,
  supabase
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const setData = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
    };
    setData();
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const value: AuthContextProps = { user, session, supabase };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  return useContext(AuthContext);
};