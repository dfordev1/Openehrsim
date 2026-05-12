import { cn } from '../lib/utils';
import { CheckCircle2 } from 'lucide-react';
import type { WorkflowStage } from '../types';

interface WorkflowProgressProps {
  currentStage: WorkflowStage;
  onStageClick: (stage: WorkflowStage) => void;
  completedStages: WorkflowStage[];
  disabled?: boolean;
}

const STAGES: { id: WorkflowStage; label: string; shortLabel: string }[] = [
  { id: 'triage', label: 'Triage', shortLabel: 'Tri' },
  { id: 'history', label: 'History', shortLabel: 'Hx' },
  { id: 'exam', label: 'Physical Exam', shortLabel: 'PE' },
  { id: 'diagnostics', label: 'Diagnostics', shortLabel: 'Dx' },
  { id: 'dxpause', label: 'DxPause', shortLabel: 'DxP' },
  { id: 'management', label: 'Management', shortLabel: 'Mgmt' },
];

export function WorkflowProgress({ currentStage, onStageClick, completedStages, disabled }: WorkflowProgressProps) {
  const currentIdx = STAGES.findIndex(s => s.id === currentStage);

  return (
    <div className="flex items-center w-full" role="navigation" aria-label="Clinical workflow stages">
      {STAGES.map((stage, idx) => {
        const isActive = stage.id === currentStage;
        // A stage only counts as "done" in the visual if it is both marked
        // completed AND is not the one the user is currently standing on.
        const isCompleted = !isActive && completedStages.includes(stage.id);
        const isPast = idx < currentIdx && !isCompleted;

        return (
          <div key={stage.id} className="flex items-center flex-1 last:flex-initial">
            <button
              onClick={() => !disabled && onStageClick(stage.id)}
              disabled={disabled}
              className={cn(
                'relative flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-all min-w-0',
                isActive && 'bg-teal-50 ring-1 ring-teal-300',
                !isActive && !disabled && 'hover:bg-clinical-bg cursor-pointer',
                disabled && 'cursor-not-allowed opacity-60'
              )}
              aria-current={isActive ? 'step' : undefined}
              aria-label={`${stage.label}${isActive ? ' (current)' : isCompleted ? ' (completed)' : ''}`}
            >
              {/* Circle indicator */}
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-colors',
                isActive ? 'bg-teal-600 border-teal-600 text-white shadow-sm shadow-teal-600/30' :
                isCompleted ? 'bg-teal-100 border-teal-400 text-teal-700' :
                isPast ? 'bg-clinical-bg border-clinical-slate/30 text-clinical-slate' :
                'bg-white border-clinical-line text-clinical-slate/50'
              )}>
                {isActive
                  ? idx + 1
                  : isCompleted
                  ? <CheckCircle2 className="w-3.5 h-3.5" />
                  : idx + 1}
              </div>
              {/* Label */}
              <span className={cn(
                'text-[9px] font-semibold uppercase tracking-wide whitespace-nowrap',
                isActive ? 'text-teal-700' :
                isCompleted ? 'text-teal-600' :
                'text-clinical-slate/60'
              )}>
                <span className="hidden sm:inline">{stage.label}</span>
                <span className="sm:hidden">{stage.shortLabel}</span>
              </span>
            </button>

            {/* Connector line */}
            {idx < STAGES.length - 1 && (
              <div className={cn(
                'flex-1 h-0.5 mx-1 rounded-full transition-colors',
                idx < currentIdx ? 'bg-teal-400' :
                idx === currentIdx ? 'bg-teal-200' :
                'bg-clinical-line'
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}
