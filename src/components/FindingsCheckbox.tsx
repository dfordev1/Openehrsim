import { cn } from '../lib/utils';
import { CheckSquare, Square, AlertCircle } from 'lucide-react';

interface FindingsCheckboxProps {
  label: string;
  value: string | number;
  normalRange?: string;
  isAbnormal?: boolean;
  isChecked: boolean;
  onToggle: () => void;
  source: 'vitals' | 'history' | 'exam' | 'lab' | 'imaging';
}

/**
 * A checkbox row that syncs findings to the Diagnosis Pad.
 * Used in Triage (vitals), History (ROS), Exam, and Diagnostics stages.
 * Checking a finding adds it to the Findings tab; unchecking removes it.
 */
export function FindingsCheckbox({
  label, value, normalRange, isAbnormal, isChecked, onToggle, source,
}: FindingsCheckboxProps) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs transition-all text-left',
        isChecked
          ? 'bg-teal-50 border border-teal-200'
          : 'bg-white border border-clinical-line/50 hover:border-teal-200 hover:bg-teal-50/30'
      )}
      role="checkbox"
      aria-checked={isChecked}
    >
      {/* Checkbox icon */}
      {isChecked ? (
        <CheckSquare className="w-4 h-4 text-teal-600 shrink-0" />
      ) : (
        <Square className="w-4 h-4 text-clinical-slate/30 shrink-0" />
      )}

      {/* Label */}
      <span className="flex-1 text-clinical-ink font-medium">{label}</span>

      {/* Value */}
      <span className={cn(
        'font-mono text-xs',
        isAbnormal ? 'text-red-600 font-bold' : 'text-clinical-ink'
      )}>
        {value}
      </span>

      {/* Abnormal indicator */}
      {isAbnormal && (
        <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
      )}

      {/* Normal range (small) */}
      {normalRange && (
        <span className="text-[9px] text-clinical-slate/50 hidden sm:inline">
          ({normalRange})
        </span>
      )}
    </button>
  );
}
