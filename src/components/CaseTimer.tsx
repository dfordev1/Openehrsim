import { useState, useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '../lib/utils';

interface CaseTimerProps {
  isActive: boolean; // Whether to count (pause when loading, case closed, etc.)
  onTimeUpdate?: (seconds: number) => void;
}

export function CaseTimer({ isActive, onTimeUpdate }: CaseTimerProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isActive) {
      intervalRef.current = setInterval(() => {
        setElapsedSeconds(prev => {
          const next = prev + 1;
          onTimeUpdate?.(next);
          return next;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isActive, onTimeUpdate]);

  // Reset when not active and elapsed is 0 (new case)
  useEffect(() => {
    if (!isActive && elapsedSeconds === 0) return;
  }, [isActive, elapsedSeconds]);

  const reset = () => setElapsedSeconds(0);

  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  // Color coding based on time spent
  const colorClass =
    elapsedSeconds < 120 ? 'text-clinical-slate/60' :   // < 2 min
    elapsedSeconds < 300 ? 'text-clinical-green' :      // < 5 min
    elapsedSeconds < 600 ? 'text-clinical-amber' :      // < 10 min
    'text-clinical-red';                                  // > 10 min

  return (
    <div className={cn('flex items-center gap-1.5 text-xs font-mono', colorClass)} title="Time spent on this case">
      <Clock className="w-3 h-3" />
      <span className="font-semibold tabular-nums">{formatted}</span>
    </div>
  );
}
