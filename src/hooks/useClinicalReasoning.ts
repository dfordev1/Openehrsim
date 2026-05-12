import { useState, useCallback } from 'react';
import type { ClinicalFinding, DifferentialEntry, WorkflowStage } from '../types';

export function useClinicalReasoning() {
  // ── Problem Representation ──────────────────────────────────────────────────
  const [problemRepresentation, setProblemRepresentation] = useState('');

  // ── Differential Diagnosis ──────────────────────────────────────────────────
  const [differentials, setDifferentials] = useState<DifferentialEntry[]>([]);

  const addDifferential = useCallback((diagnosis: string) => {
    setDifferentials(prev => {
      if (prev.some(d => d.diagnosis.toLowerCase() === diagnosis.toLowerCase())) return prev;
      const entry: DifferentialEntry = {
        id: `ddx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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
        next[0].isLead = true;
      }
      return next;
    });
  }, []);

  const setLeadDiagnosis = useCallback((id: string) => {
    setDifferentials(prev => prev.map(d => ({ ...d, isLead: d.id === id })));
  }, []);

  const updateConfidence = useCallback((id: string, confidence: 'high' | 'moderate' | 'low') => {
    setDifferentials(prev => prev.map(d => d.id === id ? { ...d, confidence } : d));
  }, []);

  // ── Findings Tracker ────────────────────────────────────────────────────────
  const [findings, setFindings] = useState<ClinicalFinding[]>([]);

  const addFinding = useCallback((finding: Omit<ClinicalFinding, 'id'>) => {
    setFindings(prev => {
      // Don't add duplicate text
      if (prev.some(f => f.text === finding.text)) return prev;
      return [...prev, { ...finding, id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }];
    });
  }, []);

  const removeFinding = useCallback((id: string) => {
    setFindings(prev => prev.filter(f => f.id !== id));
  }, []);

  const updateRelevance = useCallback((id: string, relevance: 'positive' | 'negative' | 'none') => {
    setFindings(prev => prev.map(f => f.id === id ? { ...f, relevance } : f));
  }, []);

  // ── Workflow Stages ─────────────────────────────────────────────────────────
  const [currentStage, setCurrentStage] = useState<WorkflowStage>('triage');
  const [completedStages, setCompletedStages] = useState<WorkflowStage[]>([]);

  const goToStage = useCallback((stage: WorkflowStage) => {
    setCurrentStage(prev => {
      // Mark previous stage as completed
      setCompletedStages(cs => cs.includes(prev) ? cs : [...cs, prev]);
      return stage;
    });
  }, []);

  const markStageCompleted = useCallback((stage: WorkflowStage) => {
    setCompletedStages(prev => prev.includes(stage) ? prev : [...prev, stage]);
  }, []);

  // ── Reset (for new case) ────────────────────────────────────────────────────
  const resetReasoning = useCallback(() => {
    setProblemRepresentation('');
    setDifferentials([]);
    setFindings([]);
    setCurrentStage('triage');
    setCompletedStages([]);
  }, []);

  return {
    // PR
    problemRepresentation,
    setProblemRepresentation,
    // DDx
    differentials,
    addDifferential,
    removeDifferential,
    setLeadDiagnosis,
    updateConfidence,
    // Findings
    findings,
    addFinding,
    removeFinding,
    updateRelevance,
    // Workflow
    currentStage,
    completedStages,
    goToStage,
    markStageCompleted,
    // Reset
    resetReasoning,
  };
}
