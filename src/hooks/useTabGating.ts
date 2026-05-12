import { useMemo } from 'react';
import type { WorkflowStage, ClinicalFinding, DifferentialEntry } from '../types';

interface TabGatingInput {
  currentStage: WorkflowStage;
  completedStages: WorkflowStage[];
  findings: ClinicalFinding[];
  differentials: DifferentialEntry[];
  problemRepresentation: string;
  hasExamined: boolean; // At least one system examined
  hasOrderedTests: boolean; // At least one lab or imaging ordered
}

interface TabGateResult {
  canProceed: boolean;
  reason: string | null;
  nextStage: WorkflowStage | null;
}

const STAGE_ORDER: WorkflowStage[] = ['triage', 'history', 'exam', 'diagnostics', 'dxpause', 'management'];

/**
 * Determines whether the learner can proceed to the next stage.
 * Returns gate status with reason if blocked.
 */
export function useTabGating(input: TabGatingInput): TabGateResult {
  return useMemo(() => {
    const { currentStage, completedStages, findings, differentials, problemRepresentation, hasExamined, hasOrderedTests } = input;
    const currentIdx = STAGE_ORDER.indexOf(currentStage);
    const nextStage = currentIdx < STAGE_ORDER.length - 1 ? STAGE_ORDER[currentIdx + 1] : null;

    switch (currentStage) {
      case 'triage':
        // Can always proceed from triage (minimal gate)
        return { canProceed: true, reason: null, nextStage };

      case 'history':
        // Must have at least 1 finding tracked
        if (findings.length < 1) {
          return { canProceed: false, reason: 'Select at least one finding before proceeding.', nextStage };
        }
        return { canProceed: true, reason: null, nextStage };

      case 'exam':
        // Must have examined at least one system
        if (!hasExamined) {
          return { canProceed: false, reason: 'Examine at least one organ system before proceeding.', nextStage };
        }
        return { canProceed: true, reason: null, nextStage };

      case 'diagnostics':
        // Must have ordered at least one test
        if (!hasOrderedTests) {
          return { canProceed: false, reason: 'Order at least one diagnostic test before proceeding.', nextStage };
        }
        return { canProceed: true, reason: null, nextStage };

      case 'dxpause':
        // Must have at least 1 differential and a problem representation
        if (differentials.length < 1) {
          return { canProceed: false, reason: 'Add at least one differential diagnosis.', nextStage };
        }
        if (problemRepresentation.trim().length < 20) {
          return { canProceed: false, reason: 'Write a problem representation (20+ characters).', nextStage };
        }
        return { canProceed: true, reason: null, nextStage };

      case 'management':
        // No gate on management (assessment handles completion)
        return { canProceed: true, reason: null, nextStage: null };

      default:
        return { canProceed: true, reason: null, nextStage };
    }
  }, [input]);
}

/**
 * Determines if a specific stage is accessible (unlocked).
 * A stage is accessible if all prior stages are completed OR the stage is the current/previous one.
 */
export function isStageAccessible(
  targetStage: WorkflowStage,
  currentStage: WorkflowStage,
  completedStages: WorkflowStage[]
): boolean {
  const targetIdx = STAGE_ORDER.indexOf(targetStage);
  const currentIdx = STAGE_ORDER.indexOf(currentStage);

  // Can always go back
  if (targetIdx <= currentIdx) return true;

  // Can go forward only if all prior stages are completed
  for (let i = 0; i < targetIdx; i++) {
    if (!completedStages.includes(STAGE_ORDER[i]) && STAGE_ORDER[i] !== currentStage) {
      return false;
    }
  }
  return true;
}
