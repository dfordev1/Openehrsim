import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { useCase } from './CaseContext';

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
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);

  const toggleCommand = useCallback(() => setIsCommandOpen(p => !p), []);
  const openLibrary   = useCallback(() => setIsLibraryOpen(true), []);

  useEffect(() => {
    if (isCommandOpen || isLibraryOpen || isConsultOpen) return;
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'k')                                     { e.preventDefault(); toggleCommand(); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey)                      { e.preventDefault(); handleUndo();    return; }
      if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); handleRedo(); return; }
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey)                                     { e.preventDefault(); openLibrary();   return; }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isCommandOpen, isLibraryOpen, isConsultOpen, toggleCommand, handleUndo, handleRedo, openLibrary]);

  return (
    <NavigationContext.Provider value={{ isLibraryOpen, setIsLibraryOpen, isCommandOpen, setIsCommandOpen }}>
      {children}
    </NavigationContext.Provider>
  );
}
