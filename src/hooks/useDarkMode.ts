import { useState, useEffect, useCallback } from 'react';

export function useDarkMode(): [boolean, () => void] {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem('openehr-dark-mode');
    if (stored !== null) return stored !== 'false';
    return true; // dark by default — Bloomberg Terminal aesthetic
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.remove('light');
    } else {
      root.classList.add('light');
    }
    localStorage.setItem('openehr-dark-mode', String(isDark));
  }, [isDark]);

  const toggle = useCallback(() => {
    setIsDark(prev => !prev);
  }, []);

  return [isDark, toggle];
}
