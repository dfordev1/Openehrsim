import { cn } from '../lib/utils';
import type { WorkflowStage, StageCommitment } from '../types';

const STAGES: { id: WorkflowStage; label: string; shortLabel: string }[] = [
  { id: 'triage', label: 'Triage', shortLabel: 'TRI' },
  { id: 'history', label: 'History', shortLabel: 'HX' },
  { id: 'exam', label: 'Exam', shortLabel: 'PE' },
  { id: 'diagnostics', label: 'Diagnostics', shortLabel: 'DX' },
  { id: 'dxpause', label: 'Dx Pause', shortLabel: 'DDX' },
  { id: 'management', label: 'Management', shortLabel: 'MGT' },
];

interface WorkflowStepperProps {
  currentStage: WorkflowStage;
  commitments: StageCommitment[];
  onNavigate: (stage: WorkflowStage) => void;
}

export function WorkflowStepper({ currentStage, commitments, onNavigate }: WorkflowStepperProps) {
  const committedStages = new Set(commitments.map(c => c.stage));
  const currentIndex = STAGES.findIndex(s => s.id === currentStage);

  return (
    <div className="flex items-center gap-1 px-2 py-1.5 rounded-xl border border-clinical-line overflow-x-auto no-scrollbar" style={{ background: 'var(--clinical-surface)' }}>
      {STAGES.map((stage, i) => {
        const isActive = stage.id === currentStage;
        const isCommitted = committedStages.has(stage.id);
        const isPast = i < currentIndex;
        const isFuture = i > currentIndex;

        return (
          <button
            key={stage.id}
            onClick={() => onNavigate(stage.id)}
            className={cn(
              'relative flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all duration-200',
              isActive && 'bg-clinical-teal-soft text-clinical-teal stage-active',
              isCommitted && !isActive && 'text-clinical-green',
              isPast && !isCommitted && !isActive && 'text-clinical-slate',
              isFuture && 'text-clinical-slate/50',
            )}
          >
            {/* Status dot */}
            <span className={cn(
              'w-1.5 h-1.5 rounded-full shrink-0',
              isActive && 'bg-clinical-teal vital-pulse',
              isCommitted && !isActive && 'bg-clinical-green stage-completed',
              !isActive && !isCommitted && isPast && 'bg-clinical-slate/40',
              isFuture && 'bg-clinical-slate/20',
            )} />

            {/* Label — show short on mobile, full on desktop */}
            <span className="hidden sm:inline">{stage.label}</span>
            <span className="sm:hidden">{stage.shortLabel}</span>

            {/* Connector line */}
            {i < STAGES.length - 1 && (
              <span className={cn(
                'absolute -right-1 top-1/2 w-1.5 h-px',
                isPast || isActive ? 'bg-clinical-teal/40' : 'bg-clinical-line',
              )} />
            )}
          </button>
        );
      })}
    </div>
  );
}
