import { useState, useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { MedicalCase, CaseEvaluation } from '../types';
import { endCase } from '../services/geminiService';
import { saveCCSResult } from '../services/storageService';
import type { UseClinicalReasoning } from './useClinicalReasoning';

interface Deps {
  medicalCase: MedicalCase | null;
  reasoning: UseClinicalReasoning;
  addToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  setLogs: Dispatch<SetStateAction<{ time: string; text: string }[]>>;
}

export function useEvaluationHandlers({ medicalCase, reasoning, addToast, setLogs }: Deps) {
  const [userNotes, setUserNotes] = useState('');
  const [evaluation, setEvaluation] = useState<CaseEvaluation | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [differential, setDifferential] = useState('');

  const handleEndCase = useCallback(async () => {
    if (!medicalCase || submitting) return;
    setSubmitting(true);
    setLogs((prev) => [...prev, { time: new Date().toLocaleTimeString(), text: 'CASE CLOSED — scoring...' }]);
    try {
      const findingsByDx = reasoning.findings
        .filter(f => f.relevanceByDx && Object.keys(f.relevanceByDx).length > 0)
        .map(f => ({
          findingText: f.text,
          source: f.source,
          relevanceByDx: f.relevanceByDx!,
        }));

      const result = await endCase(medicalCase.id, medicalCase, userNotes, {
        problemRepresentation: reasoning.problemRepresentation,
        differentials: reasoning.differentials.map(d => ({
          diagnosis: d.diagnosis,
          confidence: d.confidence,
          isLead: d.isLead,
          ...(d.illnessScript ? { illnessScript: d.illnessScript } : {}),
        })),
        findingsCount: reasoning.findings.length,
        positiveFindings: reasoning.findings.filter(f => f.relevance === 'positive').map(f => f.text),
        negativeFindings: reasoning.findings.filter(f => f.relevance === 'negative').map(f => f.text),
        prHistory: reasoning.prHistory.map(s => ({ stage: s.stage, text: s.text, simTime: s.simTime })),
        stageCommitments: reasoning.stageCommitments.map(c => {
          const lead = reasoning.differentials.find(d => d.id === c.leadDiagnosisId);
          return {
            stage: c.stage,
            simTime: c.simTime,
            differentialCount: c.committedDifferentialIds.length,
            ...(lead ? { leadDiagnosis: lead.diagnosis } : {}),
          };
        }),
        findingsByDx,
      });

      setEvaluation(result);
      setLogs((prev) => [...prev, { time: new Date().toLocaleTimeString(), text: `SCORE: ${result.score}/100` }]);
      saveCCSResult(medicalCase, result).catch(console.error);
      addToast(`Case scored — ${result.score}/100`, 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Scoring failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }, [medicalCase, submitting, userNotes, reasoning, addToast, setLogs]);

  return {
    userNotes,
    setUserNotes,
    evaluation,
    submitting,
    differential,
    setDifferential,
    handleEndCase,
  };
}
