/**
 * AuthContext — user authentication state extracted from App.tsx.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { getSupabase } from '../lib/supabase';
import type { User } from '../lib/supabase';

// ── Types ───────────────────────────────────────────────────────────────────
export interface AuthContextValue {
  user: User | null;
  isAuthOpen: boolean;
  setIsAuthOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isSupabaseConfigured: boolean;
  handleLogout: () => Promise<void>;
}

// ── Context ─────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

// ── Provider ────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSupabaseConfigured, setIsSupabaseConfigured] = useState(true);

  useEffect(() => {
    const supabase = getSupabase();
    setIsSupabaseConfigured(!!supabase);
    if (!supabase) return;
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) =>
      setUser(session?.user ?? null)
    );
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = useCallback(async () => {
    const supabase = getSupabase();
    if (supabase) await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthOpen, setIsAuthOpen, isSupabaseConfigured, handleLogout }}>
      {children}
    </AuthContext.Provider>
  );
}
