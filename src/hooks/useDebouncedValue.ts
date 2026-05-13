import { useEffect, useState } from 'react';

/**
 * Debounces a rapidly-changing value. The returned value only updates
 * after `delayMs` have passed without further changes to the input.
 *
 * Typical use: heavy state updates driven by keystrokes (e.g. saving a
 * Problem Representation draft to localStorage, or running a derived
 * computation like a findings search). The textarea itself should still
 * bind to the *undebounced* value so typing feels instant; effects that
 * need to react to the final typed value should depend on the debounced
 * one.
 */
export function useDebouncedValue<T>(value: T, delayMs: number = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
