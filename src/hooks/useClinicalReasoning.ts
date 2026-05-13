import { useState, useCallback, useMemo } from 'react';
import type {
  ClinicalFinding,
  DifferentialEntry,
  IllnessScript,
  PRSnapshot,
  StageCommitment,
  StageRequirements,
  WorkflowStage,
} from '../types';

// ── Ordering & per-stage gate requirements ──────────────────────────────────
export const STAGE_ORDER: WorkflowStage[] = [
  'triage',
  'history',
  'exam',
  'diagnostics',
  'dxpause',
  'management',
];

export const STAGE_LABELS: Record<WorkflowStage, string> = {
  triage: 'Triage',
  history: 'History',
  exam: 'Physical Exam',
  diagnostics: 'Diagnostics',
  dxpause: 'DxPause',
  management: 'Management',
};

/** Stage-specific gate requirements. The pedagogy is: start *broad* early
 *  (at triage/history we want ≥3 differentials under consideration), and
 *  progressively *narrow* by dxpause/management where a lead must be
 *  committed. */
export const STAGE_REQUIREMENTS: Record<WorkflowStage, StageRequirements> = {
  triage:      { minPrLength: 20,  minDifferentials: 2, requiresLead: false },
  history:     { minPrLength: 40,  minDifferentials: 3, requiresLead: false },
  exam:        { minPrLength: 50,  minDifferentials: 3, requiresLead: false },
  diagnostics: { minPrLength: 60,  minDifferentials: 3, requiresLead: false },
  dxpause:     { minPrLength: 80,  minDifferentials: 2, requiresLead: true,  requiresFindingsLinked: true },
  management:  { minPrLength: 100, minDifferentials: 1, requiresLead: true,  requiresFindingsLinked: true },
};

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function useClinicalReasoning() {
  // ── Problem Representation (working draft + committed snapshots) ──────────
  const [problemRepresentation, setProblemRepresentation] = useState('');
  const [prHistory, setPrHistory] = useState<PRSnapshot[]>([]);

  /** The most recent committed PR snapshot, if any. */
  const latestPrSnapshot = useMemo<PRSnapshot | undefined>(
    () => (prHistory.length ? prHistory[prHistory.length - 1] : undefined),
    [prHistory],
  );

  /** Is the working PR different from the last committed snapshot? */
  const prIsDirty = useMemo(() => {
    if (!latestPrSnapshot) return problemRepresentation.trim().length > 0;
    return problemRepresentation.trim() !== latestPrSnapshot.text.trim();
  }, [problemRepresentation, latestPrSnapshot]);

  // ── Differential Diagnosis ────────────────────────────────────────────────
  const [differentials, setDifferentials] = useState<DifferentialEntry[]>([]);

  const addDifferential = useCallback((diagnosis: string) => {
    setDifferentials(prev => {
      if (prev.some(d => d.diagnosis.toLowerCase() === diagnosis.toLowerCase())) return prev;
      const entry: DifferentialEntry = {
        id: newId('ddx'),
        diagnosis,
        confidence: 'moderate',
        addedAt: Date.now(),
        isLead: prev.length === 0, // first one is lead by default
      };
      return [...prev, entry];
    });
  }, []);

  const removeDifferential = useCallback((id: string) => {
    setDifferentials(prev => {
      const next = prev.filter(d => d.id !== id);
      // If removed the lead, make the first one lead
      if (next.length > 0 && !next.some(d => d.isLead)) {
        next[0] = { ...next[0], isLead: true };
      }
      return next;
    });
  }, []);

  const setLeadDiagnosis = useCallback((id: string) => {
    setDifferentials(prev => prev.map(d => ({ ...d, isLead: d.id === id })));
  }, []);

  const updateConfidence = useCallback(
    (id: string, confidence: 'high' | 'moderate' | 'low') => {
      setDifferentials(prev =>
        prev.map(d => (d.id === id ? { ...d, confidence } : d)),
      );
    },
    [],
  );

  /** Set/replace the illness script for a differential entry. */
  const setIllnessScript = useCallback(
    (id: string, script: IllnessScript) => {
      setDifferentials(prev =>
        prev.map(d => (d.id === id ? { ...d, illnessScript: script } : d)),
      );
    },
    [],
  );

  // ── Findings Tracker ──────────────────────────────────────────────────────
  const [findings, setFindings] = useState<ClinicalFinding[]>([]);

  const addFinding = useCallback((finding: Omit<ClinicalFinding, 'id'>) => {
    setFindings(prev => {
      if (prev.some(f => f.text === finding.text)) return prev;
      return [...prev, { ...finding, id: newId('f') }];
    });
  }, []);

  const removeFinding = useCallback((id: string) => {
    setFindings(prev => prev.filter(f => f.id !== id));
  }, []);

  /** Overall relevance (legacy single-axis). */
  const updateRelevance = useCallback(
    (id: string, relevance: 'positive' | 'negative' | 'none') => {
      setFindings(prev =>
        prev.map(f => (f.id === id ? { ...f, relevance } : f)),
      );
    },
    [],
  );

  /** Per-differential relevance. This is the Healer-style matrix cell: is
   *  this finding a pertinent positive or negative for *this specific*
   *  differential? */
  const updateFindingRelevanceForDx = useCallback(
    (
      findingId: string,
      differentialId: string,
      relevance: 'positive' | 'negative' | 'none',
    ) => {
      setFindings(prev =>
        prev.map(f => {
          if (f.id !== findingId) return f;
          const next = { ...(f.relevanceByDx || {}) };
          if (relevance === 'none') {
            delete next[differentialId];
          } else {
            next[differentialId] = relevance;
          }
          // Also update the legacy single relevance to match the dominant
          // assignment across dxs, so legacy views keep working.
          const values = Object.values(next);
          const overall: 'positive' | 'negative' | 'none' =
            values.includes('positive') ? 'positive' :
            values.includes('negative') ? 'negative' : 'none';
          return { ...f, relevanceByDx: next, relevance: overall };
        }),
      );
    },
    [],
  );

  // ── Workflow Stages & Commitments ─────────────────────────────────────────
  const [currentStage, setCurrentStage] = useState<WorkflowStage>('triage');
  const [completedStages, setCompletedStages] = useState<WorkflowStage[]>([]);
  const [stageCommitments, setStageCommitments] = useState<StageCommitment[]>([]);

  const goToStage = useCallback((stage: WorkflowStage) => {
    setCurrentStage(prev => {
      if (prev === stage) return prev;
      const prevIdx = STAGE_ORDER.indexOf(prev);
      const nextIdx = STAGE_ORDER.indexOf(stage);
      // Only mark the previous stage complete when advancing forward.
      // Jumping backward (e.g. to re-review history) shouldn't stamp it as done.
      if (nextIdx > prevIdx) {
        setCompletedStages(cs => (cs.includes(prev) ? cs : [...cs, prev]));
      }
      return stage;
    });
  }, []);

  const markStageCompleted = useCallback((stage: WorkflowStage) => {
    setCompletedStages(prev => (prev.includes(stage) ? prev : [...prev, stage]));
  }, []);

  /** Check whether the current state meets the gate requirements for a
   *  given stage. Returns the list of unmet requirements; empty list
   *  means the gate passes. */
  const checkStageGate = useCallback(
    (stage: WorkflowStage): string[] => {
      const req = STAGE_REQUIREMENTS[stage];
      const unmet: string[] = [];
      if (problemRepresentation.trim().length < req.minPrLength) {
        unmet.push(
          `Problem representation must be at least ${req.minPrLength} characters (currently ${problemRepresentation.trim().length}).`,
        );
      }
      if (differentials.length < req.minDifferentials) {
        unmet.push(
          `At least ${req.minDifferentials} differential diagnos${req.minDifferentials === 1 ? 'is' : 'es'} required (currently ${differentials.length}).`,
        );
      }
      if (req.requiresLead && !differentials.some(d => d.isLead)) {
        unmet.push('A lead (working) diagnosis must be selected.');
      }
      if (req.requiresFindingsLinked) {
        const anyLinked = findings.some(
          f => f.relevanceByDx && Object.keys(f.relevanceByDx).length > 0,
        );
        if (!anyLinked) {
          unmet.push(
            'At least one finding must be linked to a specific differential (mark it as a pertinent positive or negative).',
          );
        }
      }
      return unmet;
    },
    [problemRepresentation, differentials, findings],
  );

  /** Commit the current reasoning at a stage gate: snapshots the PR,
   *  records which differentials were on the table, and captures the
   *  lead diagnosis. Returns the created snapshot id, or null if the
   *  gate requirements are not met. */
  const commitStage = useCallback(
    (stage: WorkflowStage, simTime: number): string | null => {
      const unmet = checkStageGate(stage);
      if (unmet.length > 0) return null;
      const snapshot: PRSnapshot = {
        id: newId('pr'),
        stage,
        text: problemRepresentation.trim(),
        simTime,
        createdAt: Date.now(),
      };
      setPrHistory(prev => [...prev, snapshot]);
      const lead = differentials.find(d => d.isLead);
      const commitment: StageCommitment = {
        stage,
        prSnapshotId: snapshot.id,
        committedDifferentialIds: differentials.map(d => d.id),
        leadDiagnosisId: lead?.id,
        committedAt: Date.now(),
        simTime,
      };
      setStageCommitments(prev => [...prev, commitment]);
      setCompletedStages(prev =>
        prev.includes(stage) ? prev : [...prev, stage],
      );
      return snapshot.id;
    },
    [problemRepresentation, differentials, checkStageGate],
  );

  // ── Reset (for new case) ──────────────────────────────────────────────────
  const resetReasoning = useCallback(() => {
    setProblemRepresentation('');
    setPrHistory([]);
    setDifferentials([]);
    setFindings([]);
    setCurrentStage('triage');
    setCompletedStages([]);
    setStageCommitments([]);
  }, []);

  return {
    // PR
    problemRepresentation,
    setProblemRepresentation,
    prHistory,
    latestPrSnapshot,
    prIsDirty,
    // DDx
    differentials,
    addDifferential,
    removeDifferential,
    setLeadDiagnosis,
    updateConfidence,
    setIllnessScript,
    // Findings
    findings,
    addFinding,
    removeFinding,
    updateRelevance,
    updateFindingRelevanceForDx,
    // Workflow
    currentStage,
    completedStages,
    stageCommitments,
    goToStage,
    markStageCompleted,
    commitStage,
    checkStageGate,
    // Reset
    resetReasoning,
  };
}

export type UseClinicalReasoning = ReturnType<typeof useClinicalReasoning>;
