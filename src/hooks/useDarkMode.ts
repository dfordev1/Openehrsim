import { useState, useEffect, useCallback } from 'react';

export function useDarkMode(): [boolean, () => void] {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem('openehr-dark-mode');
    if (stored !== null) return stored === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('openehr-dark-mode', String(isDark));
  }, [isDark]);

  const toggle = useCallback(() => {
    setIsDark(prev => !prev);
  }, []);

  return [isDark, toggle];
}
