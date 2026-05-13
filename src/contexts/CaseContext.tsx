import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { MedicalCase, CaseEvaluation, LabResult, ConsultantAdvice } from '../types';
import type { WorkflowStage } from '../types';
import { generateMedicalCase } from '../services/geminiService';
import { getRecentSimulations } from '../services/storageService';
import { useToast } from '../components/Toast';
import { useUndoStack } from '../hooks/useUndoStack';
import { useVitalsPoll } from '../hooks/useVitalsPoll';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useClinicalReasoning, STAGE_ORDER } from '../hooks/useClinicalReasoning';
import type { UseClinicalReasoning } from '../hooks/useClinicalReasoning';
import { useInterventionHandlers } from '../hooks/useInterventionHandlers';
import { useCommsHandlers } from '../hooks/useCommsHandlers';
import { useEvaluationHandlers } from '../hooks/useEvaluationHandlers';
import type { PadTab } from '../components/DiagnosisPad';
import { PR_DRAFT_STORAGE_PREFIX } from '../lib/constants';
import type { VitalsHistoryEntry } from '../hooks/useVitalsPoll';



// ── Types ────────────────────────────────────────────────────────────────────
export interface CaseContextValue {
  // Case & loading
  medicalCase: MedicalCase | null;
  loading: boolean;
  error: string | null;
  loadingStep: string;

  // Patient outcome
  patientOutcome: 'alive' | 'deceased' | 'critical_deterioration' | null;

  // Vitals
  vitalsHistory: VitalsHistoryEntry[];

  // AI Consultant
  consultantAdvice: ConsultantAdvice | null;
  isConsulting: boolean;
  isConsultOpen: boolean;
  setIsConsultOpen: React.Dispatch<React.SetStateAction<boolean>>;

  // Intervention / orders
  interventionInput: string;
  setInterventionInput: React.Dispatch<React.SetStateAction<string>>;
  intervening: boolean;

  // Diagnosis / CCS evaluation
  userNotes: string;
  setUserNotes: React.Dispatch<React.SetStateAction<string>>;
  evaluation: CaseEvaluation | null;
  setEvaluation: React.Dispatch<React.SetStateAction<CaseEvaluation | null>>;
  submitting: boolean;
  differential: string;
  setDifferential: React.Dispatch<React.SetStateAction<string>>;

  // Comms
  callTarget: string;
  setCallTarget: React.Dispatch<React.SetStateAction<string>>;
  callMessage: string;
  setCallMessage: React.Dispatch<React.SetStateAction<string>>;
  calling: boolean;

  // Logs
  logs: { time: string; text: string }[];
  setLogs: React.Dispatch<React.SetStateAction<{ time: string; text: string }[]>>;

  // Clinical reasoning
  reasoning: UseClinicalReasoning;
  isDxPadOpen: boolean;
  setIsDxPadOpen: React.Dispatch<React.SetStateAction<boolean>>;
  dxPadInitialTab: PadTab | undefined;
  setDxPadInitialTab: React.Dispatch<React.SetStateAction<PadTab | undefined>>;
  pendingStage: WorkflowStage | null;
  setPendingStage: React.Dispatch<React.SetStateAction<WorkflowStage | null>>;

  // Undo / redo
  canUndo: boolean;
  canRedo: boolean;
  lastAction: string | null;
  nextRedoAction: string | null;
  handleUndo: () => void;
  handleRedo: () => void;

  // Handlers
  loadNewCase: (difficulty?: string, category?: string, environment?: string) => Promise<void>;
  handlePerformIntervention: (customWait?: number, directIntervention?: string) => Promise<void>;
  handleStaffCall: () => Promise<void>;
  handleConsult: () => Promise<void>;
  handleOrderTest: (type: 'lab' | 'imaging', name: string) => Promise<void>;
  handleAdvanceTime: (minutes: number) => Promise<void>;
  handleEndCase: () => Promise<void>;
  handleStageNavigate: (target: WorkflowStage) => void;

  // Derived
  simTime: number;
  setMedicalCase: React.Dispatch<React.SetStateAction<MedicalCase | null>>;
}



// ── Context ──────────────────────────────────────────────────────────────────
const CaseContext = createContext<CaseContextValue | null>(null);

export function useCase(): CaseContextValue {
  const ctx = useContext(CaseContext);
  if (!ctx) throw new Error('useCase must be used within a CaseProvider');
  return ctx;
}

// ── Provider ─────────────────────────────────────────────────────────────────
export function CaseProvider({ children }: { children: ReactNode }) {
  const { addToast } = useToast();

  // ── Case & loading ────────────────────────────────────────────────────────
  const [medicalCase, setMedicalCase] = useState<MedicalCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState('Initialising…');
  const [patientOutcome, setPatientOutcome] = useState<'alive' | 'deceased' | 'critical_deterioration' | null>(null);

  // ── Vitals history ────────────────────────────────────────────────────────
  const [vitalsHistory, setVitalsHistory] = useState<VitalsHistoryEntry[]>([]);

  // ── Activity log ──────────────────────────────────────────────────────────
  const [logs, setLogs] = useState<{ time: string; text: string }[]>([]);

  // ── Undo / redo ───────────────────────────────────────────────────────────
  const { pushUndo, popUndo, popRedo, canUndo, canRedo, lastAction, nextRedoAction } = useUndoStack();

  // ── Clinical reasoning ────────────────────────────────────────────────────
  const reasoning = useClinicalReasoning();
  const [isDxPadOpen, setIsDxPadOpen] = useState(false);
  const [dxPadInitialTab, setDxPadInitialTab] = useState<PadTab | undefined>(undefined);
  const [pendingStage, setPendingStage] = useState<WorkflowStage | null>(null);

  // ── Handler hooks ─────────────────────────────────────────────────────────
  const interventionHandlers = useInterventionHandlers({
    medicalCase, setMedicalCase, pushUndo, addToast, reasoning, setPatientOutcome, setLogs,
  });

  const commsHandlers = useCommsHandlers({
    medicalCase, setMedicalCase, pushUndo, addToast, setLogs,
  });

  const evaluationHandlers = useEvaluationHandlers({
    medicalCase, reasoning, addToast, setLogs,
  });

  // ── PR draft autosave ─────────────────────────────────────────────────────
  const debouncedPr = useDebouncedValue(reasoning.problemRepresentation, 500);
  useEffect(() => {
    if (!medicalCase?.id || typeof window === 'undefined') return;
    try {
      const key = `${PR_DRAFT_STORAGE_PREFIX}${medicalCase.id}`;
      if (debouncedPr.trim().length === 0) {
        window.localStorage.removeItem(key);
      } else {
        window.localStorage.setItem(key, debouncedPr);
      }
    } catch {
      /* storage disabled */
    }
  }, [debouncedPr, medicalCase?.id]);

  useEffect(() => {
    if (!medicalCase?.id || typeof window === 'undefined') return;
    try {
      const saved = window.localStorage.getItem(`${PR_DRAFT_STORAGE_PREFIX}${medicalCase.id}`);
      if (saved && saved.length > reasoning.problemRepresentation.length) {
        reasoning.setProblemRepresentation(saved);
        addToast('Restored draft problem representation from last session', 'info');
      }
    } catch {
      /* no-op */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medicalCase?.id]);

  // ── Undo / redo handlers ──────────────────────────────────────────────────
  const handleUndo = useCallback(() => {
    const entry = popUndo();
    if (entry) {
      setMedicalCase(entry.caseSnapshot);
      addToast(`Undid: ${entry.label}`, 'info');
    }
  }, [popUndo, addToast]);

  const handleRedo = useCallback(() => {
    const entry = popRedo();
    if (entry) {
      setMedicalCase(entry.caseSnapshot);
      addToast(`Redid: ${entry.label}`, 'info');
    }
  }, [popRedo, addToast]);

  // ── Vitals live update ────────────────────────────────────────────────────
  useEffect(() => {
    if (!medicalCase?.vitals) return;
    setVitalsHistory((prev) => {
      const sys = parseInt(medicalCase.vitals.bloodPressure.split('/')[0]) || 120;
      const entry = {
        time: `T+${medicalCase.simulationTime}`,
        hr: medicalCase.vitals.heartRate,
        sbp: sys,
        rr: medicalCase.vitals.respiratoryRate,
        spo2: medicalCase.vitals.oxygenSaturation,
      };
      if (prev.length > 0 && prev[prev.length - 1].time === entry.time) return prev;
      return [...prev, entry].slice(-15);
    });
  }, [medicalCase?.simulationTime, medicalCase?.vitals]);

  useVitalsPoll({
    medicalCase,
    setVitalsHistory,
    enabled: patientOutcome !== 'deceased',
  });

  // ── Load case ─────────────────────────────────────────────────────────────
  const loadNewCase = useCallback(async (difficulty?: string, category?: string, environment?: string) => {
    setLoading(true);
    setError(null);
    setLoadingStep('Connecting to clinical simulation engine…');
    evaluationHandlers.setUserNotes('');
    evaluationHandlers.setDifferential('');
    evaluationHandlers.setEvaluation(null);
    setPatientOutcome(null);
    setLogs([{ time: new Date().toLocaleTimeString(), text: 'ADMIT: Patient registered in system.' }]);
    reasoning.resetReasoning();
    try {
      setLoadingStep('Retrieving recent simulation history…');
      const history = await getRecentSimulations();
      setLoadingStep('Generating patient case with AI engine…');
      const newCase = await generateMedicalCase(difficulty, category, history, environment);
      setLoadingStep('Initialising monitoring systems…');
      setMedicalCase(newCase);
      if (newCase.vitals) {
        const v = newCase.vitals;
        reasoning.addFinding({ source: 'vitals', text: `HR ${v.heartRate} bpm`, relevance: 'none', addedAt: 0 });
        reasoning.addFinding({ source: 'vitals', text: `BP ${v.bloodPressure} mmHg`, relevance: 'none', addedAt: 0 });
        reasoning.addFinding({ source: 'vitals', text: `SpO2 ${v.oxygenSaturation}%`, relevance: 'none', addedAt: 0 });
        reasoning.addFinding({ source: 'vitals', text: `RR ${v.respiratoryRate}/min`, relevance: 'none', addedAt: 0 });
        reasoning.addFinding({ source: 'vitals', text: `Temp ${v.temperature}°C`, relevance: 'none', addedAt: 0 });
      }
      const hrBase = newCase.vitals?.heartRate || 75;
      const sysBase = parseInt(newCase.vitals?.bloodPressure.split('/')[0]) || 120;
      const rrBase = newCase.vitals?.respiratoryRate || 16;
      const spo2Base = newCase.vitals?.oxygenSaturation || 98;
      setVitalsHistory(
        Array.from({ length: 10 }, (_, i) => ({
          time: `T-${10 - i}m`,
          hr: hrBase + (Math.random() * 4 - 2),
          sbp: sysBase + (Math.random() * 6 - 3),
          rr: rrBase + (Math.random() * 2 - 1),
          spo2: Math.min(100, spo2Base + (Math.random() * 1 - 0.5)),
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Clinical database connection failure.');
    } finally {
      setLoading(false);
    }
  // evaluation handlers intentionally omitted from deps — only the stable setters are called
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadNewCase(); }, [loadNewCase]);

  // ── Stage navigation ──────────────────────────────────────────────────────
  const simTime = medicalCase?.simulationTime || 0;

  const handleStageNavigate = useCallback(
    (target: WorkflowStage) => {
      const from = reasoning.currentStage;
      if (target === from) return;
      const fromIdx = STAGE_ORDER.indexOf(from);
      const toIdx = STAGE_ORDER.indexOf(target);

      if (toIdx < fromIdx) {
        reasoning.goToStage(target);
        return;
      }

      const unmet = reasoning.checkStageGate(from);
      if (unmet.length === 0) {
        const snapId = reasoning.commitStage(from, simTime);
        if (snapId) {
          reasoning.goToStage(target);
          addToast(`Committed ${from} → ${target}`, 'success');
          return;
        }
      }

      setPendingStage(target);
    },
    [reasoning, simTime, addToast],
  );

  // ── Context value ─────────────────────────────────────────────────────────
  const value: CaseContextValue = {
    medicalCase,
    loading,
    error,
    loadingStep,
    patientOutcome,
    vitalsHistory,
    logs,
    setLogs,
    reasoning,
    isDxPadOpen,
    setIsDxPadOpen,
    dxPadInitialTab,
    setDxPadInitialTab,
    pendingStage,
    setPendingStage,
    canUndo,
    canRedo,
    lastAction,
    nextRedoAction,
    handleUndo,
    handleRedo,
    loadNewCase,
    handleStageNavigate,
    simTime,
    setMedicalCase,
    ...interventionHandlers,
    ...commsHandlers,
    ...evaluationHandlers,
  };

  return (
    <CaseContext.Provider value={value}>
      {children}
    </CaseContext.Provider>
  );
}
