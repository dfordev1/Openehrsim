import { useEffect } from 'react';
import type { MedicalCase } from '../types';

export interface VitalsHistoryEntry {
  time: string;
  hr: number;
  sbp: number;
  rr: number;
  spo2: number;
}

interface UseVitalsPollOptions {
  /** Active case. When null the poller is disabled. */
  medicalCase: MedicalCase | null;
  /** Push function for the vitals history (use the same setter you pass
   *  to <VitalsExpanded>). */
  setVitalsHistory: React.Dispatch<React.SetStateAction<VitalsHistoryEntry[]>>;
  /** Poll interval in ms. Default 3000 (matches previous inline value). */
  intervalMs?: number;
  /** Disable the poller without unmounting the component (e.g. when a
   *  patient has expired). */
  enabled?: boolean;
}

/**
 * Emits a slightly-jittered vitals sample every `intervalMs`, extending
 * the trailing window in state. Previously this was a 25-line inline
 * `setInterval` in App.tsx — extracting it keeps App.tsx focused on
 * orchestration and makes the polling policy testable.
 *
 * The jitter amounts deliberately match the original inline
 * implementation so chart visuals stay identical.
 */
export function useVitalsPoll({
  medicalCase,
  setVitalsHistory,
  intervalMs = 3000,
  enabled = true,
}: UseVitalsPollOptions) {
  useEffect(() => {
    if (!medicalCase || !enabled) return;
    const interval = setInterval(() => {
      setVitalsHistory(prev => {
        const last = prev[prev.length - 1];
        if (!last) return prev;
        return [
          ...prev.slice(1),
          {
            time: new Date().toLocaleTimeString(),
            hr: (medicalCase.vitals?.heartRate || 75) + (Math.random() * 2 - 1),
            sbp: last.sbp + (Math.random() * 1 - 0.5),
            rr: last.rr + (Math.random() * 0.4 - 0.2),
            spo2: Math.min(100, last.spo2 + (Math.random() * 0.2 - 0.1)),
          },
        ];
      });
    }, intervalMs);
    return () => clearInterval(interval);
  }, [medicalCase, enabled, intervalMs, setVitalsHistory]);
}
