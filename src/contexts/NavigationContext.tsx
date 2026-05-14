/**
 * NavigationContext — library/command modals and keyboard shortcuts.
 * Tab navigation removed: the app is now a single scrollable feed.
 */

import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { useCase } from './CaseContext';
import { useAuth } from './AuthContext';

export interface NavigationContextValue {
  isLibraryOpen: boolean;
  setIsLibraryOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isCommandOpen: boolean;
  setIsCommandOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function useNavigation(): NavigationContextValue {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useNavigation must be used within a NavigationProvider');
  return ctx;
}

export function NavigationProvider({ children }: { children: ReactNode }) {
  const { handleUndo, handleRedo, isConsultOpen } = useCase();
  const { user } = useAuth();

  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);

  const handleNewCase = useCallback(() => setIsLibraryOpen(true), []);
  const handleCommandPalette = useCallback(() => setIsCommandOpen(p => !p), []);

  useEffect(() => {
    if (isCommandOpen || isLibraryOpen || isConsultOpen) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); handleCommandPalette(); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); return; }
      if ((e.metaKey || e.ctrlKey) && ((e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y')) { e.preventDefault(); handleRedo(); return; }
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); handleNewCase(); return; }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isCommandOpen, isLibraryOpen, isConsultOpen, handleCommandPalette, handleNewCase, handleUndo, handleRedo]);

  return (
    <NavigationContext.Provider value={{ isLibraryOpen, setIsLibraryOpen, isCommandOpen, setIsCommandOpen }}>
      {children}
    </NavigationContext.Provider>
  );
}
