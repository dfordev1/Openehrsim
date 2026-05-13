/**
 * CaseContext — all case-related state & handlers extracted from App.tsx.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { CaseEvaluation, MedicalCase, LabResult, ConsultantAdvice } from '../types';
import type { WorkflowStage } from '../types';
import { generateMedicalCase, performIntervention, staffCall, orderTest, endCase } from '../services/geminiService';
import { getConsultantAdvice } from '../services/aiConsultantService';
import { saveCCSResult, getRecentSimulations } from '../services/storageService';
import { useToast } from '../components/Toast';
import { useUndoStack } from '../hooks/useUndoStack';
import { useVitalsPoll } from '../hooks/useVitalsPoll';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useClinicalReasoning, STAGE_ORDER } from '../hooks/useClinicalReasoning';
import type { UseClinicalReasoning } from '../hooks/useClinicalReasoning';
import type { PadTab } from '../components/DiagnosisPad';
import { PR_DRAFT_STORAGE_PREFIX } from '../lib/constants';
import type { VitalsHistoryEntry } from '../hooks/useVitalsPoll';



// ── Types ───────────────────────────────────────────────────────────────────
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
  vitalsExpanded: boolean;
  setVitalsExpanded: React.Dispatch<React.SetStateAction<boolean>>;

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
  feedback: { score: number; feedback: string } | null;
  submitting: boolean;
  differential: string;
  setDifferential: React.Dispatch<React.SetStateAction<string>>;

  // Comms
  callTarget: string;
  setCallTarget: React.Dispatch<React.SetStateAction<string>>;
  callMessage: string;
  setCallMessage: React.Dispatch<React.SetStateAction<string>>;
  calling: boolean;

  // Labs / imaging
  selectedLab: LabResult | null;
  setSelectedLab: React.Dispatch<React.SetStateAction<LabResult | null>>;
  revealedStudies: string[];
  setRevealedStudies: React.Dispatch<React.SetStateAction<string[]>>;

  // Exam (GCS)
  gcsState: { eyes: number; verbal: number; motor: number };
  setGcsState: React.Dispatch<React.SetStateAction<{ eyes: number; verbal: number; motor: number }>>;
  gcsExpanded: boolean;
  setGcsExpanded: React.Dispatch<React.SetStateAction<boolean>>;

  // Pharmacy
  customMedInput: string;
  setCustomMedInput: React.Dispatch<React.SetStateAction<string>>;

  // Treatment
  transferExpanded: boolean;
  setTransferExpanded: React.Dispatch<React.SetStateAction<boolean>>;

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



// ── Context ─────────────────────────────────────────────────────────────────
const CaseContext = createContext<CaseContextValue | null>(null);

export function useCase(): CaseContextValue {
  const ctx = useContext(CaseContext);
  if (!ctx) throw new Error('useCase must be used within a CaseProvider');
  return ctx;
}

// ── Provider ────────────────────────────────────────────────────────────────
export function CaseProvider({ children }: { children: ReactNode }) {
  const { addToast } = useToast();

  // ── Case & loading state ──────────────────────────────────────────────────
  const [medicalCase, setMedicalCase] = useState<MedicalCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState('Initialising…');

  // ── Patient outcome ───────────────────────────────────────────────────────
  const [patientOutcome, setPatientOutcome] = useState<'alive' | 'deceased' | 'critical_deterioration' | null>(null);

  // ── Vitals ────────────────────────────────────────────────────────────────
  const [vitalsHistory, setVitalsHistory] = useState<VitalsHistoryEntry[]>([]);
  const [vitalsExpanded, setVitalsExpanded] = useState(false);

  // ── AI Consultant ─────────────────────────────────────────────────────────
  const [consultantAdvice, setConsultantAdvice] = useState<ConsultantAdvice | null>(null);
  const [isConsulting, setIsConsulting] = useState(false);
  const [isConsultOpen, setIsConsultOpen] = useState(false);

  // ── Intervention / orders ─────────────────────────────────────────────────
  const [interventionInput, setInterventionInput] = useState('');
  const [intervening, setIntervening] = useState(false);

  // ── Diagnosis / CCS evaluation ───────────────────────────────────────────
  const [userNotes, setUserNotes] = useState('');
  const [evaluation, setEvaluation] = useState<CaseEvaluation | null>(null);
  const [feedback, setFeedback] = useState<{ score: number; feedback: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [differential, setDifferential] = useState('');

  // ── Comms ─────────────────────────────────────────────────────────────────
  const [callTarget, setCallTarget] = useState('Nursing Station');
  const [callMessage, setCallMessage] = useState('');
  const [calling, setCalling] = useState(false);

  // ── Labs / imaging ────────────────────────────────────────────────────────
  const [selectedLab, setSelectedLab] = useState<LabResult | null>(null);
  const [revealedStudies, setRevealedStudies] = useState<string[]>([]);

  // ── Exam (GCS) ────────────────────────────────────────────────────────────
  const [gcsState, setGcsState] = useState({ eyes: 4, verbal: 5, motor: 6 });
  const [gcsExpanded, setGcsExpanded] = useState(false);

  // ── Pharmacy ──────────────────────────────────────────────────────────────
  const [customMedInput, setCustomMedInput] = useState('');

  // ── Treatment ─────────────────────────────────────────────────────────────
  const [transferExpanded, setTransferExpanded] = useState(false);

  // ── Logs ──────────────────────────────────────────────────────────────────
  const [logs, setLogs] = useState<{ time: string; text: string }[]>([]);

  // ── Undo / redo ───────────────────────────────────────────────────────────
  const { pushUndo, popUndo, popRedo, canUndo, canRedo, lastAction, nextRedoAction } = useUndoStack();

  // ── Clinical Reasoning ────────────────────────────────────────────────────
  const reasoning = useClinicalReasoning();
  const [isDxPadOpen, setIsDxPadOpen] = useState(true);
  const [dxPadInitialTab, setDxPadInitialTab] = useState<PadTab | undefined>(undefined);
  const [pendingStage, setPendingStage] = useState<WorkflowStage | null>(null);



  // ── PR draft autosave ────────────────────────────────────────────────────
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
      /* storage disabled — no-op */
    }
  }, [debouncedPr, medicalCase?.id]);

  // Rehydrate any saved draft when a case id first appears.
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
    // Intentionally only on case-id change; don't depend on reasoning.*
    // to avoid a restore loop.
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

  // Live vitals sampling (jitter)
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
    setEvaluation(null);
    setFeedback(null);
    setUserNotes('');
    setDifferential('');
    setRevealedStudies([]);
    setPatientOutcome(null);
    setSelectedLab(null);
    setLogs([{ time: new Date().toLocaleTimeString(), text: 'ADMIT: Patient registered in system.' }]);
    reasoning.resetReasoning();
    try {
      setLoadingStep('Retrieving recent simulation history…');
      const history = await getRecentSimulations();
      setLoadingStep('Generating patient case with AI engine…');
      const newCase = await generateMedicalCase(difficulty, category, history, environment);
      setLoadingStep('Initialising monitoring systems…');
      setMedicalCase(newCase);
      // Auto-add initial vitals as findings in Diagnosis Pad
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadNewCase(); }, [loadNewCase]);



  // ── Intervention handler ──────────────────────────────────────────────────
  const handlePerformIntervention = useCallback(async (customWait?: number, directIntervention?: string) => {
    if (!medicalCase || intervening) return;
    const action = directIntervention || interventionInput || 'Observation';
    pushUndo(`Intervention: ${action}`, medicalCase);
    setIntervening(true);
    setLogs((prev) => [
      ...prev,
      {
        time: new Date().toLocaleTimeString(),
        text: directIntervention
          ? `ACTION: ${directIntervention}`
          : customWait
          ? `WAIT ${customWait} min`
          : `ORDER: ${interventionInput}`,
      },
    ]);
    try {
      const updated = await performIntervention(action, medicalCase, customWait || 5);
      setMedicalCase((prev) =>
        prev
          ? {
              ...prev,
              ...updated,
              labs: updated.labs || prev.labs,
              imaging: updated.imaging || prev.imaging,
              clinicalActions: updated.clinicalActions || prev.clinicalActions,
              vitals: { ...prev.vitals, ...(updated.vitals || {}) },
            }
          : updated
      );
      if (updated.patientOutcome && updated.patientOutcome !== 'alive') {
        setPatientOutcome(updated.patientOutcome);
        addToast(
          updated.patientOutcome === 'deceased'
            ? '⚠️ Patient has expired. Case concluded.'
            : '🔴 Critical deterioration — patient is unstable.',
          'error'
        );
      }
      setInterventionInput('');
      addToast(`Intervention executed: ${action}`, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Intervention failed';
      console.error('Intervention failed:', err);
      addToast(msg, 'error');
    } finally {
      setIntervening(false);
    }
  }, [medicalCase, intervening, interventionInput, pushUndo, addToast]);

  // ── Staff call handler ────────────────────────────────────────────────────
  const handleStaffCall = useCallback(async () => {
    if (!medicalCase || !callMessage) return;
    pushUndo(`Call: ${callTarget}`, medicalCase);
    setCalling(true);
    try {
      const { reply, updatedCase } = await staffCall(callTarget, callMessage, medicalCase);
      setMedicalCase(updatedCase);
      setCallMessage('');
      setLogs((prev) => [
        ...prev,
        { time: new Date().toLocaleTimeString(), text: `COMM: Call to ${callTarget} - "${reply.slice(0, 30)}..."` },
      ]);
      addToast(`Staff call to ${callTarget} completed`, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Staff call failed';
      console.error(err);
      addToast(msg, 'error');
    } finally {
      setCalling(false);
    }
  }, [medicalCase, callMessage, callTarget, pushUndo, addToast]);

  // ── AI Consultant handler ─────────────────────────────────────────────────
  const handleConsult = useCallback(async () => {
    if (!medicalCase) return;
    setIsConsulting(true);
    setIsConsultOpen(true);
    try {
      const advice = await getConsultantAdvice(medicalCase);
      setConsultantAdvice(advice);
      const updated = await performIntervention('Requested Specialty Consultation', medicalCase, 10);
      setMedicalCase(updated);
      setLogs((prev) => [{ time: `T + ${updated.simulationTime}`, text: 'Expert Consultation requested (+10 min)' }, ...prev]);
    } catch (err: any) {
      console.error(err);
      addToast(err?.message || 'Consultant is currently unavailable.', 'error');
    } finally {
      setIsConsulting(false);
    }
  }, [medicalCase, addToast]);



  // ── CCS: order a test ─────────────────────────────────────────────────────
  const handleOrderTest = useCallback(async (type: 'lab' | 'imaging', name: string) => {
    if (!medicalCase || intervening) return;
    setIntervening(true);
    setLogs((prev) => [...prev, { time: new Date().toLocaleTimeString(), text: `ORDER: ${name}` }]);
    try {
      const result = await orderTest(medicalCase.id, type, name, medicalCase.simulationTime, 'stat');
      setMedicalCase((prev) => {
        if (!prev) return prev;
        return type === 'lab'
          ? { ...prev, labs: [...(prev.labs || []), result.testResult], clinicalActions: [...(prev.clinicalActions || []), result.action] }
          : { ...prev, imaging: [...(prev.imaging || []), result.testResult], clinicalActions: [...(prev.clinicalActions || []), result.action] };
      });
      // Auto-track finding in Diagnosis Pad
      reasoning.addFinding({
        source: type === 'lab' ? 'lab' : 'imaging',
        text: `${name} ordered (T+${medicalCase.simulationTime}m)`,
        relevance: 'none',
        addedAt: medicalCase.simulationTime,
      });
      addToast(result.message, 'success');
    } catch (err: any) {
      addToast(err.message || 'Failed to order test', 'error');
    } finally {
      setIntervening(false);
    }
  }, [medicalCase, intervening, reasoning, addToast]);

  // ── CCS: advance time ─────────────────────────────────────────────────────
  const handleAdvanceTime = useCallback(async (minutes: number) => {
    if (!medicalCase || intervening) return;
    pushUndo(`Advance +${minutes}m`, medicalCase);
    setIntervening(true);
    setLogs((prev) => [...prev, { time: new Date().toLocaleTimeString(), text: `ADVANCE TIME: +${minutes} min` }]);
    try {
      const updated = await performIntervention('', medicalCase, minutes);
      setMedicalCase((prev) => prev
        ? { ...prev, ...updated, labs: updated.labs ?? prev.labs, imaging: updated.imaging ?? prev.imaging, availableTests: prev.availableTests }
        : updated);
      if (updated.patientOutcome && updated.patientOutcome !== 'alive') {
        setPatientOutcome(updated.patientOutcome);
        addToast(updated.patientOutcome === 'deceased' ? '⚠️ Patient has expired.' : '🔴 Critical deterioration.', 'error');
      }
      addToast(`Clock → T+${updated.simulationTime} min`, 'success');
    } catch (err: any) {
      addToast(err.message || 'Failed to advance time', 'error');
    } finally {
      setIntervening(false);
    }
  }, [medicalCase, intervening, pushUndo, addToast]);



  // ── CCS: end case & score ─────────────────────────────────────────────────
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
        prHistory: reasoning.prHistory.map(s => ({
          stage: s.stage,
          text: s.text,
          simTime: s.simTime,
        })),
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
    } catch (err: any) {
      addToast(err.message || 'Scoring failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }, [medicalCase, submitting, userNotes, reasoning, addToast]);



  // ── Stage navigation ──────────────────────────────────────────────────────
  const simTime = medicalCase?.simulationTime || 0;

  /** Map workflow stages to the tab ids used by activeTab. */
  const stageToTab: Record<WorkflowStage, string> = {
    triage: 'triage',
    history: 'hpi',
    exam: 'exam',
    diagnostics: 'labs',
    dxpause: 'dxpause',
    management: 'treatment',
  };

  const handleStageNavigate = useCallback(
    (target: WorkflowStage) => {
      const from = reasoning.currentStage;
      if (target === from) return;
      const fromIdx = STAGE_ORDER.indexOf(from);
      const toIdx = STAGE_ORDER.indexOf(target);

      // Moving backward — free navigation, no commit recorded
      if (toIdx < fromIdx) {
        reasoning.goToStage(target);
        // Tab change is handled by NavigationContext listening to stage changes
        return;
      }

      // Moving forward — require commit on the *current* stage
      const unmet = reasoning.checkStageGate(from);
      if (unmet.length === 0) {
        const snapId = reasoning.commitStage(from, simTime);
        if (snapId) {
          reasoning.goToStage(target);
          addToast(`Committed ${from} → ${target}`, 'success');
          return;
        }
      }

      // Gate fails → open the modal to let the user fill in what's missing
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
    vitalsExpanded,
    setVitalsExpanded,
    consultantAdvice,
    isConsulting,
    isConsultOpen,
    setIsConsultOpen,
    interventionInput,
    setInterventionInput,
    intervening,
    userNotes,
    setUserNotes,
    evaluation,
    feedback,
    submitting,
    differential,
    setDifferential,
    callTarget,
    setCallTarget,
    callMessage,
    setCallMessage,
    calling,
    selectedLab,
    setSelectedLab,
    revealedStudies,
    setRevealedStudies,
    gcsState,
    setGcsState,
    gcsExpanded,
    setGcsExpanded,
    customMedInput,
    setCustomMedInput,
    transferExpanded,
    setTransferExpanded,
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
    handlePerformIntervention,
    handleStaffCall,
    handleConsult,
    handleOrderTest,
    handleAdvanceTime,
    handleEndCase,
    handleStageNavigate,
    simTime,
    setMedicalCase,
  };

  return (
    <CaseContext.Provider value={value}>
      {children}
    </CaseContext.Provider>
  );
}
