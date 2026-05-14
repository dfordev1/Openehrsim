import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import type {
  ClinicalFinding,
  DifferentialEntry,
  MedicalCase,
  IllnessScript,
  PRSnapshot,
} from '../../types';

interface DxPauseTabProps {
  medicalCase: MedicalCase;
  problemRepresentation: string;
  onProblemRepresentationChange: (val: string) => void;
  differentials: DifferentialEntry[];
  findings: ClinicalFinding[];
  prHistory: PRSnapshot[];
  prIsDirty: boolean;
  onUpdateFindingRelevanceForDx: (
    findingId: string,
    differentialId: string,
    relevance: 'positive' | 'negative' | 'none',
  ) => void;
  onSetIllnessScript: (id: string, script: IllnessScript) => void;
  onSetLead: (id: string) => void;
  onProceedToManagement: () => void;
  simTime: number;
}

export function DxPauseTab({
  problemRepresentation,
  differentials,
  onSetLead,
  onProceedToManagement,
}: DxPauseTabProps) {
  const prLen = problemRepresentation.trim().length;
  const canProceed = prLen >= 80 && differentials.length >= 2;

  return (
    <motion.div
      key="dxpause"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-8 py-8"
    >
      <p className="text-sm text-clinical-slate">
        Pause and reflect. What's your leading diagnosis?
      </p>

      {/* Show current PR if any */}
      {problemRepresentation.trim() && (
        <p className="text-sm text-clinical-ink italic">"{problemRepresentation}"</p>
      )}

      {/* Show differentials as read-only list */}
      {differentials.length > 0 && (
        <div className="space-y-1">
          {differentials.map((d, i) => (
            <button
              key={d.id}
              onClick={() => onSetLead(d.id)}
              className={cn(
                'block text-left text-sm',
                d.isLead ? 'text-clinical-ink font-medium' : 'text-clinical-slate hover:text-clinical-ink',
              )}
            >
              {i + 1}. {d.diagnosis} {d.isLead && '←'}
            </button>
          ))}
        </div>
      )}

      {/* Proceed button */}
      <button
        onClick={onProceedToManagement}
        disabled={!canProceed}
        className="text-sm text-clinical-slate hover:text-clinical-ink disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        Proceed to Management →
      </button>

      {!canProceed && (
        <p className="text-xs text-clinical-slate/50">
          Complete your problem representation (≥80 chars) and add ≥2 differentials in the Dx Pad.
        </p>
      )}
    </motion.div>
  );
}
