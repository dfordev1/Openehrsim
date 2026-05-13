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
  isAuthLoading: boolean;
  isRecovery: boolean;
  clearRecovery: () => void;
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
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();
    setIsSupabaseConfigured(!!supabase);
    if (!supabase) {
      setIsAuthLoading(false);
      return;
    }
    supabase.auth.getUser()
      .then(({ data }) => setUser((data as any).user ?? null))
      .finally(() => setIsAuthLoading(false));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
        setIsAuthOpen(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = useCallback(async () => {
    const supabase = getSupabase();
    if (supabase) await supabase.auth.signOut();
  }, []);

  const clearRecovery = useCallback(() => setIsRecovery(false), []);

  return (
    <AuthContext.Provider value={{ user, isAuthOpen, setIsAuthOpen, isSupabaseConfigured, isAuthLoading, isRecovery, clearRecovery, handleLogout }}>
      {children}
    </AuthContext.Provider>
  );
}
