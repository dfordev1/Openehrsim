import { useEffect, useState } from 'react';

/**
 * React hook that tracks a CSS media query. SSR-safe (returns the
 * `defaultValue` when `window` is undefined).
 *
 * Example: `const isMobile = useMediaQuery('(max-width: 1023px)');`
 *
 * Used by DiagnosisPad to switch between side-panel and bottom-sheet
 * presentations, mirroring Tailwind's `lg` breakpoint (1024px).
 */
export function useMediaQuery(query: string, defaultValue = false): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return defaultValue;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    // Sync once on mount in case the initial SSR fallback was wrong
    setMatches(mql.matches);
    // modern browsers: addEventListener; older Safari: addListener
    if (mql.addEventListener) {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
    // Legacy Safari fallback — cast to any to avoid deprecated-API type noise
    (mql as any).addListener(onChange);
    return () => {
      (mql as any).removeListener(onChange);
    };
  }, [query]);

  return matches;
}
