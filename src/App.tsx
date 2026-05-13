/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Sentry from '@sentry/react';
import React, { useState, useEffect, useCallback, Component, ErrorInfo, ReactNode } from 'react';
import {
  Activity,
  AlertCircle,
  BookOpen,
  Brain,
  CheckCircle2,
  Clipboard,
  Command,
  FileSearch,
  FlaskConical,
  History,
  Loader2,
  Maximize2,
  Menu,
  Moon,
  PenTool,
  Phone,
  Pill,
  RefreshCw,
  Sparkles,
  Stethoscope,
  Sun,
  Undo2,
  X,
  Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CaseEvaluation, MedicalCase, LabResult, ConsultantAdvice } from './types';
import { generateMedicalCase, performIntervention, staffCall, orderTest, endCase } from './services/geminiService';
import { getConsultantAdvice } from './services/aiConsultantService';
import { saveCCSResult, getRecentSimulations } from './services/storageService';
import { getSupabase } from './lib/supabase';
import type { User } from './lib/supabase';
import { cn } from './lib/utils';
import { ToastProvider, useToast } from './components/Toast';
import { AuthModal } from './components/Auth';
import { ClinicalNotes } from './components/ClinicalNotes';
import { ClinicalGuidelines } from './components/ClinicalGuidelines';
import { ClinicalVital } from './components/ClinicalVital';
import { NavTab } from './components/NavTab';
import { CaseLibrary } from './components/CaseLibrary';
import { ArchiveView } from './components/ArchiveView';
import { CommandPalette } from './components/CommandPalette';
import { SkeletonCard, SkeletonVitals } from './components/Skeleton';
import { EmptyState } from './components/EmptyState';
import VitalsExpanded from './components/VitalsExpanded';
import { DiagnosisPad } from './components/DiagnosisPad';
import type { PadTab } from './components/DiagnosisPad';
import { StageCommitGate } from './components/StageCommitGate';
import { ReasoningNudges } from './components/ReasoningNudges';
import { WorkflowProgress } from './components/WorkflowProgress';
import { OnboardingTour } from './components/OnboardingTour';
import { useUrlTab } from './hooks/useUrlTab';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useUndoStack } from './hooks/useUndoStack';
import { useDarkMode } from './hooks/useDarkMode';
import { useVitalsPoll } from './hooks/useVitalsPoll';
import { useDebouncedValue } from './hooks/useDebouncedValue';
import { useClinicalReasoning, STAGE_ORDER } from './hooks/useClinicalReasoning';
import { PR_DRAFT_STORAGE_PREFIX } from './lib/constants';
import type { WorkflowStage } from './types';

// ── Tab components ────────────────────────────────────────────────────────────
import { HpiTab } from './components/tabs/HpiTab';
import { ExamTab } from './components/tabs/ExamTab';
import { LabsTab } from './components/tabs/LabsTab';
import { ImagingTab } from './components/tabs/ImagingTab';
import { PharmacyTab } from './components/tabs/PharmacyTab';
import { TreatmentTab } from './components/tabs/TreatmentTab';
import { CommsTab } from './components/tabs/CommsTab';
import { AssessmentTab } from './components/tabs/AssessmentTab';
import { TriageTab } from './components/tabs/TriageTab';
import { DxPauseTab } from './components/tabs/DxPauseTab';

// ── Error Boundary ────────────────────────────────────────────────────────────
interface ErrorBoundaryProps { children: ReactNode; }
interface ErrorBoundaryState { hasError: boolean; }

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(_: Error): ErrorBoundaryState { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI Crash:', error, info);
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-clinical-bg flex items-center justify-center p-8">
          <div className="panel p-8 max-w-md text-center">
            <AlertCircle className="w-10 h-10 text-clinical-red mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-clinical-ink mb-2">Interface Disruption</h2>
            <p className="text-sm text-clinical-slate mb-6">The clinical dashboard encountered an error.</p>
            <button onClick={() => window.location.reload()} className="w-full py-2.5 bg-clinical-blue text-white rounded-lg font-medium text-sm">
              Re-initialize Station
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return <ToastProvider><ErrorBoundary><ClinicalSimulator /></ErrorBoundary></ToastProvider>;
}

// ── ClinicalSimulator (orchestration only) ────────────────────────────────────
function ClinicalSimulator() {
  const { addToast } = useToast();

  // ── Case & loading state ──────────────────────────────────────────────────
  const [medicalCase, setMedicalCase] = useState<MedicalCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Tab / navigation ──────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useUrlTab();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);

  // ── Auth ──────────────────────────────────────────────────────────────────
  const [user, setUser] = useState<User | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSupabaseConfigured, setIsSupabaseConfigured] = useState(true);

  // ── Vitals ────────────────────────────────────────────────────────────────
  const [vitalsHistory, setVitalsHistory] = useState<{ time: string; hr: number; sbp: number; rr: number; spo2: number }[]>([]);
  const [vitalsExpanded, setVitalsExpanded] = useState(false);

  // ── Patient outcome ───────────────────────────────────────────────────────
  const [patientOutcome, setPatientOutcome] = useState<'alive' | 'deceased' | 'critical_deterioration' | null>(null);

  // ── AI Consultant ─────────────────────────────────────────────────────────
  const [consultantAdvice, setConsultantAdvice] = useState<ConsultantAdvice | null>(null);
  const [isConsulting, setIsConsulting] = useState(false);
  const [isConsultOpen, setIsConsultOpen] = useState(false);

  // ── Intervention / orders ─────────────────────────────────────────────────
  const [interventionInput, setInterventionInput] = useState('');
  const [intervening, setIntervening] = useState(false);

  // ── Diagnosis / CCS evaluation ───────────────────────────────────────────
  const [userNotes, setUserNotes]       = useState('');
  const [evaluation, setEvaluation]     = useState<CaseEvaluation | null>(null);
  const [feedback, setFeedback]         = useState<{ score: number; feedback: string } | null>(null);
  const [submitting, setSubmitting]     = useState(false);
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

  // ── Dark mode / undo ─────────────────────────────────────────────────────
  const [isDark, toggleDark] = useDarkMode();
  const { pushUndo, popUndo, popRedo, canUndo, canRedo, lastAction, nextRedoAction } = useUndoStack();

  // ── Clinical Reasoning (Healer-style) ─────────────────────────────────────
  const reasoning = useClinicalReasoning();
  const [isDxPadOpen, setIsDxPadOpen] = useState(true);
  const [dxPadInitialTab, setDxPadInitialTab] = useState<PadTab | undefined>(undefined);

  // ── PR draft autosave ────────────────────────────────────────────────────
  // Persists the working PR to localStorage (keyed by case id) so a
  // tab refresh or accidental nav-away doesn't lose uncommitted prose.
  // Only the *draft* is saved — committed snapshots live in
  // reasoning.prHistory. We debounce to avoid a write per keystroke.
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

  /** When the user tries to advance forward through a stage that has
   *  unmet gate requirements, we store the *target* stage here and show
   *  the StageCommitGate modal. When they commit (or cancel) we clear
   *  it. */
  const [pendingStage, setPendingStage] = useState<WorkflowStage | null>(null);

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

  useKeyboardShortcuts({
    onTabChange: setActiveTab,
    onNewCase: () => setIsLibraryOpen(true),
    onDiagnosis: () => setActiveTab('assess'),
    onCommandPalette: () => setIsCommandOpen((p) => !p),
    onUndo: handleUndo,
    onRedo: handleRedo,
    enabled: !isCommandOpen && !isLibraryOpen && !isConsultOpen,
  });

  // ── Supabase auth ─────────────────────────────────────────────────────────
  useEffect(() => {
    const supabase = getSupabase();
    setIsSupabaseConfigured(!!supabase);
    if (!supabase) return;
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) =>
      setUser(session?.user ?? null)
    );
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    const supabase = getSupabase();
    if (supabase) await supabase.auth.signOut();
  };

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

  // Live vitals sampling (jitter) — extracted to a reusable hook.
  useVitalsPoll({
    medicalCase,
    setVitalsHistory,
    enabled: patientOutcome !== 'deceased',
  });

  // ── Loading progress ──────────────────────────────────────────────────────
  const [loadingStep, setLoadingStep] = useState('Initialising…');

  // ── Load case ─────────────────────────────────────────────────────────────
  const loadNewCase = useCallback(async (difficulty?: string, category?: string, environment?: string) => {
    // Close the library modal *immediately* so the user sees the loading
    // skeleton rather than an invalidated picker.
    setIsLibraryOpen(false);
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
  }, []);

  useEffect(() => { loadNewCase(); }, [loadNewCase]);

  // ── Intervention handler ──────────────────────────────────────────────────
  const handlePerformIntervention = async (customWait?: number, directIntervention?: string) => {
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
  };

  // ── Staff call handler ────────────────────────────────────────────────────
  const handleStaffCall = async () => {
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
  };

  // ── AI Consultant handler ─────────────────────────────────────────────────
  const handleConsult = async () => {
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
  };

  // ── CCS: order a test ─────────────────────────────────────────────────────
  const handleOrderTest = async (type: 'lab' | 'imaging', name: string) => {
    if (!medicalCase || intervening) return;
    setIntervening(true);
    setLogs((prev) => [...prev, { time: new Date().toLocaleTimeString(), text: `ORDER: ${name}` }]);
    try {
      const result = await orderTest(medicalCase.id, type, name, medicalCase.simulationTime, 'stat');
      setMedicalCase((prev) => {
        if (!prev) return prev;
        return type === 'lab'
          ? { ...prev, labs:    [...(prev.labs    || []), result.testResult], clinicalActions: [...(prev.clinicalActions || []), result.action] }
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
  };

  // ── CCS: advance time ─────────────────────────────────────────────────────
  const handleAdvanceTime = async (minutes: number) => {
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
  };

  // ── CCS: end case & score ─────────────────────────────────────────────────
  const handleEndCase = async () => {
    if (!medicalCase || submitting) return;
    setSubmitting(true);
    setLogs((prev) => [...prev, { time: new Date().toLocaleTimeString(), text: 'CASE CLOSED — scoring...' }]);
    try {
      // Build the findings-by-dx shape only for findings that have been
      // linked to at least one differential (saves payload size).
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
  };

  // ── Tab config ────────────────────────────────────────────────────────────
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

  /** Click handler for the workflow stepper. Moving backward is always
   *  permitted. Moving forward runs through the stage-commit gate: if
   *  there are unmet requirements the gate modal opens for the
   *  *target* stage; otherwise we commit the current stage and
   *  advance. */
  const handleStageNavigate = useCallback(
    (target: WorkflowStage) => {
      const from = reasoning.currentStage;
      if (target === from) return;
      const fromIdx = STAGE_ORDER.indexOf(from);
      const toIdx = STAGE_ORDER.indexOf(target);

      // Moving backward — free navigation, no commit recorded
      if (toIdx < fromIdx) {
        reasoning.goToStage(target);
        setActiveTab(stageToTab[target] as any);
        return;
      }

      // Moving forward — require commit on the *current* stage
      const unmet = reasoning.checkStageGate(from);
      if (unmet.length === 0) {
        const snapId = reasoning.commitStage(from, simTime);
        if (snapId) {
          reasoning.goToStage(target);
          setActiveTab(stageToTab[target] as any);
          addToast(`Committed ${from} → ${target}`, 'success');
          return;
        }
      }

      // Gate fails → open the modal to let the user fill in what's missing
      setPendingStage(target);
    },
    [reasoning, simTime, setActiveTab, addToast],
  );

  const primaryTabs = [
    { id: 'triage',  icon: <AlertCircle className="w-4 h-4" />, label: 'Triage'   },
    { id: 'hpi',     icon: <Clipboard className="w-4 h-4" />,    label: 'History'  },
    { id: 'exam',    icon: <Stethoscope className="w-4 h-4" />,  label: 'Exam'     },
    { id: 'labs',    icon: <FlaskConical className="w-4 h-4" />, label: 'Labs'     },
    { id: 'imaging', icon: <FileSearch className="w-4 h-4" />,   label: 'Imaging'  },
  ];
  const actionTabs = [
    { id: 'dxpause',   icon: <Brain className="w-4 h-4" />,       label: 'DxPause'  },
    { id: 'pharmacy',  icon: <Pill className="w-4 h-4" />,       label: 'Pharmacy' },
    { id: 'treatment', icon: <Activity className="w-4 h-4" />,   label: 'Orders'   },
    { id: 'comms',     icon: <Phone className="w-4 h-4" />,      label: 'Comms'    },
  ];
  const toolTabs = [
    { id: 'assess', icon: <CheckCircle2 className="w-4 h-4" />, label: 'Assessment' },
    { id: 'notes',  icon: <PenTool className="w-4 h-4" />,      label: 'Notes'      },
    { id: 'tools',  icon: <BookOpen className="w-4 h-4" />,     label: 'Guidelines' },
    ...(user ? [{ id: 'archive', icon: <History className="w-4 h-4" />, label: 'Archive' }] : []),
  ];
  const mobileNavTabs = [
    { id: 'triage',    icon: <AlertCircle className="w-4 h-4" />, label: 'Triage' },
    { id: 'labs',      icon: <FlaskConical className="w-4 h-4" />,label: 'Labs'   },
    { id: 'dxpause',   icon: <Brain className="w-4 h-4" />,       label: 'DxP'   },
    { id: 'treatment', icon: <Activity className="w-4 h-4" />,    label: 'Orders' },
    { id: 'assess',    icon: <CheckCircle2 className="w-4 h-4" />,label: 'Assess' },
  ];

  // ── Loading / error screen ────────────────────────────────────────────────
  if (loading || error) {
    return (
      <div className="min-h-screen bg-clinical-bg flex items-center justify-center font-sans">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-6 max-w-md text-center">
          {error ? (
            <div className="panel p-8">
              <AlertCircle className="w-10 h-10 text-clinical-red mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2 text-clinical-ink">System Fault</h2>
              <p className="text-sm text-clinical-slate mb-6 leading-relaxed">{error}</p>
              <button onClick={() => loadNewCase()} className="w-full py-2.5 bg-clinical-blue text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4" /> Restart Station
              </button>
            </div>
          ) : (
            <div className="w-full max-w-sm space-y-4" role="status" aria-label="Loading">
              <div className="flex flex-col items-center gap-3 mb-4">
                <Loader2 className="w-6 h-6 animate-spin text-clinical-blue" />
                <p className="text-xs text-clinical-slate text-center font-medium">{loadingStep}</p>
              </div>
              <div className="h-1 w-full bg-clinical-line rounded-full overflow-hidden">
                <div className="h-full bg-clinical-blue rounded-full animate-pulse" style={{ width: '60%' }} />
              </div>
              <SkeletonVitals />
              <SkeletonCard />
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="h-screen bg-clinical-bg flex flex-col overflow-hidden text-clinical-ink" role="application" aria-label="Clinical Simulator">
      <VitalsExpanded isOpen={vitalsExpanded} onClose={() => setVitalsExpanded(false)} vitalsHistory={vitalsHistory} />

      {!isSupabaseConfigured && (
        <div className="bg-amber-50/80 border-b border-amber-100 py-1.5 px-4 text-xs text-amber-700 z-50">
          History disabled — Supabase not configured
        </div>
      )}

      <CaseLibrary isOpen={isLibraryOpen} onClose={() => setIsLibraryOpen(false)} onSelectCase={(d, c, e) => loadNewCase(d, c, e)} />
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      <OnboardingTour />
      <CommandPalette
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        onNavigate={(tab) => setActiveTab(tab as any)}
        onNewCase={() => setIsLibraryOpen(true)}
        onConsult={handleConsult}
        hasArchive={!!user}
        onOrderTest={medicalCase ? handleOrderTest : undefined}
        onAdminister={medicalCase ? (med) => handlePerformIntervention(2, `Administer ${med}`) : undefined}
        onAdvanceTime={medicalCase ? handleAdvanceTime : undefined}
      />

      {/* ── Header ── */}
      <header className="h-11 bg-clinical-surface border-b border-clinical-line flex items-center px-4 shrink-0 z-30" role="banner">
        <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-1.5 hover:bg-clinical-bg rounded-md mr-3" aria-label="Menu">
          <Menu className="w-4 h-4 text-clinical-slate" />
        </button>
        <span className="text-sm font-semibold text-clinical-ink hidden sm:inline tracking-tight">OpenEHR</span>
        <span className="w-px h-4 bg-clinical-line mx-3 hidden sm:inline-block" aria-hidden="true" />
        <div className="flex items-center gap-2 text-sm text-clinical-slate flex-1 min-w-0">
          <span className="font-medium text-clinical-ink truncate">{medicalCase?.patientName}</span>
          {medicalCase?.currentLocation && (
            <>
              <span className="text-clinical-line hidden md:inline" aria-hidden="true">·</span>
              <span className="text-xs text-clinical-slate/70 hidden md:inline truncate">{medicalCase?.currentLocation}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3 ml-auto">
          <button onClick={toggleDark} className="p-1.5 hover:bg-clinical-bg rounded-md transition-colors" aria-label={isDark ? 'Light mode' : 'Dark mode'}>
            {isDark ? <Sun className="w-3.5 h-3.5 text-clinical-slate" /> : <Moon className="w-3.5 h-3.5 text-clinical-slate" />}
          </button>
          <button onClick={() => setIsCommandOpen(true)} className="hidden sm:flex items-center gap-1.5 text-xs text-clinical-slate/60 hover:text-clinical-slate bg-clinical-bg border border-clinical-line rounded-md px-2.5 py-1 transition-colors" aria-label="Command palette">
            <Command className="w-3 h-3" />
            <span className="font-mono text-[10px]">K</span>
          </button>
          <span className={cn(
            'text-xs font-mono px-2 py-0.5 rounded-md font-semibold transition-colors',
            simTime === 0 ? 'text-clinical-slate/60' :
            simTime < 30  ? 'text-clinical-green bg-green-50/80' :
            simTime < 60  ? 'text-clinical-amber bg-amber-50/80' :
                            'text-clinical-red bg-red-50/80 animate-pulse'
          )} title="Simulation elapsed time — faster decisions score better">
            T+{simTime}m
          </span>
          <button onClick={() => setIsLibraryOpen(true)} className="text-clinical-slate/50 hover:text-clinical-blue transition-colors" aria-label="New case">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          {user ? (
            <button onClick={handleLogout} className="w-6 h-6 bg-clinical-blue/80 rounded-full flex items-center justify-center text-[9px] font-medium text-white" aria-label="Account">
              {user.email?.[0]}
            </button>
          ) : (
            <button onClick={() => setIsAuthOpen(true)} className="text-xs text-clinical-blue font-medium hover:underline" aria-label="Sign in">Sign in</button>
          )}
        </div>
      </header>

      {/* ── Patient Outcome Banner ── */}
      <AnimatePresence>
        {patientOutcome && patientOutcome !== 'alive' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className={cn('border-b py-2 px-4 flex items-center gap-3 shrink-0', patientOutcome === 'deceased' ? 'bg-gray-900 border-gray-700' : 'bg-red-900/80 border-red-700')}
            role="alert" aria-live="assertive"
          >
            <div className={cn('w-2 h-2 rounded-full shrink-0', patientOutcome === 'deceased' ? 'bg-gray-400' : 'bg-red-400 animate-pulse')} />
            <span className={cn('text-xs font-semibold', patientOutcome === 'deceased' ? 'text-gray-200' : 'text-red-200')}>
              {patientOutcome === 'deceased' ? '🕊 Patient Expired — Submit final diagnosis or start a new case.' : '🔴 Critical Deterioration — Immediate escalation required.'}
            </span>
            <button onClick={() => loadNewCase()} className="ml-auto text-[10px] font-medium underline text-white/70 hover:text-white">New Case</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Alarm Banner ── */}
      <AnimatePresence>
        {(medicalCase?.activeAlarms || []).length > 0 && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-red-50/60 border-b border-red-100/80 py-1.5 px-4 flex items-center gap-3 overflow-hidden shrink-0" role="alert" aria-live="assertive">
            <div className="w-1.5 h-1.5 bg-clinical-red/70 rounded-full animate-pulse shrink-0" />
            <div className="flex gap-3 text-xs text-clinical-red/80 font-medium overflow-x-auto no-scrollbar">
              {medicalCase?.activeAlarms.map((a, i) => <span key={i}>{a}</span>)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Clinical Reasoning Workflow Progress ── */}
      {medicalCase && (
        <div className="bg-clinical-surface border-b border-clinical-line/50 px-4 py-2 shrink-0">
          <WorkflowProgress
            currentStage={reasoning.currentStage}
            onStageClick={(stage) => handleStageNavigate(stage)}
            completedStages={reasoning.completedStages}
          />
        </div>
      )}

      {/* ── Real-time Reasoning Nudges ── */}
      {medicalCase && (
        <ReasoningNudges
          nudges={reasoning.nudges}
          onAction={(nudge) => {
            // Open the DxPad on the most useful sub-tab for the nudge type
            setIsDxPadOpen(true);
            switch (nudge.type) {
              case 'pr-stale':
                setDxPadInitialTab('pr');
                break;
              case 'ddx-too-narrow':
              case 'ddx-too-broad':
              case 'lead-not-committed':
              case 'illness-script-missing':
              case 'tests-without-ddx':
                setDxPadInitialTab('ddx');
                break;
              case 'findings-unassigned':
                setDxPadInitialTab('matrix');
                break;
            }
            // Reset after a tick so subsequent external sets re-fire.
            setTimeout(() => setDxPadInitialTab(undefined), 100);
          }}
        />
      )}

      {/* ── Vitals Rail ── */}
      <div className="h-11 bg-clinical-surface border-b border-clinical-line/50 flex items-center px-4 gap-3 shrink-0 overflow-x-auto no-scrollbar" role="region" aria-label="Vital signs">
        <div className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full',
          medicalCase?.physiologicalTrend === 'improving' ? 'text-clinical-green bg-green-50/80' :
          medicalCase?.physiologicalTrend === 'declining'  ? 'text-clinical-amber bg-amber-50/80' :
          medicalCase?.physiologicalTrend === 'critical'   ? 'text-clinical-red bg-red-50/80' :
          'text-clinical-slate bg-slate-50'
        )}>
          {medicalCase?.physiologicalTrend}
        </div>
        <div className="w-px h-5 bg-clinical-line/50" />
        <ClinicalVital label="HR"   value={Math.round(vitalsHistory[vitalsHistory.length-1]?.hr || medicalCase?.vitals?.heartRate || 0)} unit="bpm"  status="normal" isAlarming={medicalCase?.activeAlarms.some(a => /HR|Pulse|Brady|Tachy/i.test(a))} trend={vitalsHistory.map(v => v.hr)}   onClick={() => setVitalsExpanded(true)} />
        <ClinicalVital label="BP"   value={medicalCase?.vitals?.bloodPressure || '--'}           unit="mmHg" status="normal" isAlarming={medicalCase?.activeAlarms.some(a => /BP|Pressure|Hypotension|Hypertension/i.test(a))} trend={vitalsHistory.map(v => v.sbp)} onClick={() => setVitalsExpanded(true)} />
        <ClinicalVital label="SpO2" value={medicalCase?.vitals?.oxygenSaturation || 0}          unit="%"    status="normal" isAlarming={medicalCase?.activeAlarms.some(a => /SpO2|Saturation|Hypoxia/i.test(a))} trend={vitalsHistory.map(v => v.spo2)} onClick={() => setVitalsExpanded(true)} />
        <ClinicalVital label="RR"   value={medicalCase?.vitals?.respiratoryRate || '--'}         unit="/min" status="normal" isAlarming={medicalCase?.activeAlarms.some(a => /RR|Respiratory/i.test(a))} trend={vitalsHistory.map(v => v.rr)} onClick={() => setVitalsExpanded(true)} />
        <ClinicalVital label="Temp" value={medicalCase?.vitals?.temperature || 0}               unit="°C"   status="normal" isAlarming={medicalCase?.activeAlarms.some(a => /Temp|Temperature|Fever/i.test(a))} onClick={() => setVitalsExpanded(true)} />
        <button onClick={() => setVitalsExpanded(true)} className="ml-auto p-1 hover:bg-clinical-bg rounded transition-colors shrink-0" aria-label="Expand vitals">
          <Maximize2 className="w-3.5 h-3.5 text-clinical-slate/50" />
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden relative">

        {/* ── Mobile sidebar drawer ── */}
        <AnimatePresence>
          {isSidebarOpen && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-clinical-ink/40 backdrop-blur-sm z-[100] lg:hidden" aria-hidden="true" />
              <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed top-0 left-0 bottom-0 w-60 bg-clinical-surface border-r border-clinical-line z-[101] lg:hidden flex flex-col" role="dialog" aria-modal="true" aria-label="Navigation menu">
                <div className="flex items-center justify-between p-4 border-b border-clinical-line">
                  <span className="text-sm font-semibold tracking-tight">OpenEHR</span>
                  <button onClick={() => setIsSidebarOpen(false)} className="p-1.5 hover:bg-clinical-bg rounded-md" aria-label="Close navigation">
                    <X className="w-4 h-4 text-clinical-slate" />
                  </button>
                </div>
                <nav className="flex-1 overflow-y-auto p-3 space-y-4" aria-label="Main navigation">
                  {[{ label: 'Patient Data', tabs: primaryTabs }, { label: 'Actions', tabs: actionTabs }, { label: 'Tools', tabs: toolTabs }].map(({ label, tabs }) => (
                    <div key={label}>
                      <p className="text-[10px] font-semibold text-clinical-slate/60 uppercase tracking-wider px-3 mb-1">{label}</p>
                      {tabs.map(tab => (
                        <NavTab key={tab.id} active={activeTab === tab.id} icon={tab.icon} label={tab.label} onClick={() => { setActiveTab(tab.id as any); setIsSidebarOpen(false); }} />
                      ))}
                    </div>
                  ))}
                </nav>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* ── Desktop sidebar ── */}
        <nav className="w-48 bg-clinical-surface border-r border-clinical-line/50 flex-col py-3 px-2 z-20 shrink-0 hidden lg:flex" aria-label="Main navigation">
          <div className="space-y-4 flex-1">
            {[{ label: 'Patient Data', tabs: primaryTabs }, { label: 'Actions', tabs: actionTabs }, { label: 'Tools', tabs: toolTabs }].map(({ label, tabs }) => (
              <div key={label}>
                <p className="text-[10px] font-semibold text-clinical-slate/50 uppercase tracking-wider px-3 mb-1">{label}</p>
                <div className="space-y-0.5">
                  {tabs.map(tab => (
                    <NavTab key={tab.id} active={activeTab === tab.id} icon={tab.icon} label={tab.label} onClick={() => setActiveTab(tab.id as any)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="pt-3 px-1 border-t border-clinical-line/50">
            <button onClick={handleConsult} disabled={isConsulting || !medicalCase} className="w-full py-2 px-3 text-xs font-medium text-clinical-slate hover:text-clinical-blue hover:bg-clinical-blue/5 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-40" aria-label="AI Consultant">
              {isConsulting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              AI Consultant
            </button>
          </div>
        </nav>

        {/* ── Clinical Workspace ── */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-5 flex flex-col gap-4 pb-20 lg:pb-5" role="main" aria-label="Clinical workspace">
          <AnimatePresence mode="wait">
            {activeTab === 'triage' && medicalCase && (
              <TriageTab key="triage" medicalCase={medicalCase} />
            )}

            {activeTab === 'hpi' && medicalCase && (
              <HpiTab key="hpi" medicalCase={medicalCase} />
            )}

            {activeTab === 'exam' && medicalCase && (
              <ExamTab
                key="exam"
                medicalCase={medicalCase}
                gcsState={gcsState}
                onGcsChange={(cat, score) => setGcsState(prev => ({ ...prev, [cat]: score }))}
                gcsExpanded={gcsExpanded}
                onToggleGcs={() => setGcsExpanded(p => !p)}
                onExamineSystem={(system, finding) => {
                  setLogs(prev => [...prev, {
                    time: new Date().toLocaleTimeString(),
                    text: `EXAM: ${system.toUpperCase()} examined`,
                  }]);
                  // Track finding in Diagnosis Pad
                  reasoning.addFinding({
                    source: 'exam',
                    text: `${system}: ${finding.slice(0, 60)}${finding.length > 60 ? '…' : ''}`,
                    relevance: 'none',
                    addedAt: medicalCase.simulationTime,
                  });
                  setMedicalCase(prev => {
                    if (!prev) return prev;
                    return {
                      ...prev,
                      clinicalActions: [
                        ...(prev.clinicalActions || []),
                        {
                          id: `exam-${Date.now()}`,
                          timestamp: prev.simulationTime,
                          type: 'exam' as const,
                          description: `Examined ${system}: ${finding.slice(0, 80)}${finding.length > 80 ? '…' : ''}`,
                        },
                      ],
                    };
                  });
                }}
              />
            )}

            {activeTab === 'labs' && medicalCase && (
              <LabsTab
                key="labs"
                medicalCase={medicalCase}
                simTime={simTime}
                selectedLab={selectedLab}
                onSelectLab={setSelectedLab}
                onOrderLab={(name) => handleOrderTest('lab', name)}
              />
            )}

            {activeTab === 'imaging' && medicalCase && (
              <ImagingTab
                key="imaging"
                medicalCase={medicalCase}
                simTime={simTime}
                revealedStudies={revealedStudies}
                onRevealStudy={(type) => setRevealedStudies(prev => [...prev, type])}
                onOrderImaging={(name) => handleOrderTest('imaging', name)}
              />
            )}

            {activeTab === 'pharmacy' && (
              <PharmacyTab
                key="pharmacy"
                customMedInput={customMedInput}
                onCustomMedChange={setCustomMedInput}
                onAdminister={(med) => handlePerformIntervention(2, `Administer ${med}`)}
                intervening={intervening}
                medicalCase={medicalCase ?? undefined}
              />
            )}

            {activeTab === 'comms' && medicalCase && (
              <CommsTab
                key="comms"
                medicalCase={medicalCase}
                callTarget={callTarget}
                callMessage={callMessage}
                calling={calling}
                onSelectTarget={setCallTarget}
                onMessageChange={setCallMessage}
                onSend={handleStaffCall}
              />
            )}

            {activeTab === 'dxpause' && medicalCase && (
              <DxPauseTab
                key="dxpause"
                medicalCase={medicalCase}
                problemRepresentation={reasoning.problemRepresentation}
                onProblemRepresentationChange={reasoning.setProblemRepresentation}
                differentials={reasoning.differentials}
                findings={reasoning.findings}
                prHistory={reasoning.prHistory}
                prIsDirty={reasoning.prIsDirty}
                onUpdateFindingRelevanceForDx={reasoning.updateFindingRelevanceForDx}
                onSetIllnessScript={reasoning.setIllnessScript}
                onSetLead={reasoning.setLeadDiagnosis}
                simTime={simTime}
                onProceedToManagement={() => {
                  // DxPause → Management uses the same gate flow as the stepper
                  handleStageNavigate('management');
                }}
              />
            )}

            {activeTab === 'treatment' && medicalCase && (
              <TreatmentTab
                key="treatment"
                medicalCase={medicalCase}
                vitalsHistory={vitalsHistory}
                interventionInput={interventionInput}
                intervening={intervening}
                transferExpanded={transferExpanded}
                onInterventionChange={setInterventionInput}
                onExecuteOrder={() => handlePerformIntervention()}
                onWait={(mins) => handlePerformIntervention(mins, 'Observe patient')}
                onTransfer={(dept) => handlePerformIntervention(0, `Transfer to ${dept}`)}
                onToggleTransfer={() => setTransferExpanded(p => !p)}
                onOrderTest={handleOrderTest}
                onAdvanceTime={handleAdvanceTime}
              />
            )}

            {activeTab === 'assess' && medicalCase && (
              <AssessmentTab
                key="assess"
                medicalCase={medicalCase}
                simTime={simTime}
                userNotes={userNotes}
                evaluation={evaluation}
                feedback={feedback}
                submitting={submitting}
                logs={logs}
                differential={differential}
                onDifferentialChange={setDifferential}
                onNotesChange={setUserNotes}
                onEndCase={handleEndCase}
                onNewCase={() => loadNewCase()}
              />
            )}

            {activeTab === 'notes' && (
              <motion.div key="notes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 min-h-0">
                <ClinicalNotes />
              </motion.div>
            )}

            {activeTab === 'tools' && (
              <motion.div key="tools" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 min-h-0">
                <ClinicalGuidelines />
              </motion.div>
            )}

            {activeTab === 'archive' && (
              <motion.div key="archive" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="panel">
                <div className="panel-header">
                  <span className="panel-title">Simulation Archive</span>
                  <span className="text-[10px] text-clinical-slate/50 hidden sm:block">{user?.email || 'Unauthorized'}</span>
                </div>
                <ArchiveView user={user} />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* ── Mobile bottom nav ── */}
      <div className="mobile-bottom-nav lg:hidden">
        {mobileNavTabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={cn('mobile-bottom-nav-item', activeTab === tab.id && 'active')}>
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── Diagnosis Pad (Healer-style floating panel) ── */}
      {medicalCase && (
        <AnimatePresence>
          <DiagnosisPad
            isOpen={isDxPadOpen}
            onToggle={() => setIsDxPadOpen(p => !p)}
            initialTab={dxPadInitialTab}
            problemRepresentation={reasoning.problemRepresentation}
            onProblemRepresentationChange={reasoning.setProblemRepresentation}
            prHistory={reasoning.prHistory}
            prIsDirty={reasoning.prIsDirty}
            currentStage={reasoning.currentStage}
            differentials={reasoning.differentials}
            onAddDifferential={reasoning.addDifferential}
            onRemoveDifferential={reasoning.removeDifferential}
            onSetLeadDiagnosis={reasoning.setLeadDiagnosis}
            onUpdateConfidence={reasoning.updateConfidence}
            onSetIllnessScript={reasoning.setIllnessScript}
            findings={reasoning.findings}
            onRemoveFinding={reasoning.removeFinding}
            onUpdateRelevance={reasoning.updateRelevance}
            onUpdateFindingRelevanceForDx={reasoning.updateFindingRelevanceForDx}
          />
        </AnimatePresence>
      )}

      {/* ── Stage Commit Gate ── */}
      {medicalCase && pendingStage && (
        <StageCommitGate
          isOpen={!!pendingStage}
          fromStage={reasoning.currentStage}
          toStage={pendingStage}
          problemRepresentation={reasoning.problemRepresentation}
          onProblemRepresentationChange={reasoning.setProblemRepresentation}
          differentials={reasoning.differentials}
          onSetLead={reasoning.setLeadDiagnosis}
          findings={reasoning.findings}
          previousPrSnapshot={reasoning.latestPrSnapshot}
          unmetRequirements={reasoning.checkStageGate(reasoning.currentStage)}
          onCommit={(fromStage) => {
            const snapId = reasoning.commitStage(fromStage, simTime);
            if (snapId && pendingStage) {
              const target = pendingStage;
              reasoning.goToStage(target);
              setActiveTab(stageToTab[target] as any);
              addToast(`Committed ${fromStage} → ${target}`, 'success');
              setPendingStage(null);
            }
            return snapId;
          }}
          onCancel={() => setPendingStage(null)}
        />
      )}

      {/* ── Undo / Redo bar ── */}
      <AnimatePresence>
        {(canUndo || canRedo) && (
          <motion.div
            initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-20 lg:bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-clinical-ink text-white px-4 py-2.5 rounded-lg shadow-xl border border-white/10"
          >
            <Undo2 className="w-3.5 h-3.5 text-clinical-amber" />
            <span className="text-xs font-medium max-w-[180px] truncate">
              {canUndo ? lastAction : `Redo: ${nextRedoAction}`}
            </span>
            {canUndo && (
              <button onClick={handleUndo} className="ml-2 px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-xs font-medium transition-colors" aria-label="Undo (Cmd+Z)">
                Undo
              </button>
            )}
            {canRedo && (
              <button onClick={handleRedo} className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-xs font-medium transition-colors" aria-label="Redo (Cmd+Shift+Z)">
                Redo
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── AI Consultant slide-over ── */}
      <AnimatePresence>
        {isConsultOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsConsultOpen(false)} className="fixed inset-0 bg-clinical-ink/30 backdrop-blur-sm z-[100]" aria-hidden="true" />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} role="dialog" aria-modal="true" aria-label="AI Consultant" className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-clinical-surface border-l border-clinical-line z-[101] shadow-xl flex flex-col">
              <div className="h-14 bg-clinical-ink text-white px-5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <Brain className="w-5 h-5 text-clinical-amber" />
                  <div>
                    <h3 className="text-sm font-semibold">AI Consultant</h3>
                    <p className="text-[10px] text-white/50">Specialist reasoning · DeepSeek / Gemini</p>
                  </div>
                </div>
                <button onClick={() => setIsConsultOpen(false)} className="p-2 hover:bg-white/10 rounded-md" aria-label="Close"><X className="w-4 h-4" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {isConsulting ? (
                  <div className="h-full flex flex-col items-center justify-center gap-4" role="status">
                    <Loader2 className="w-8 h-8 animate-spin text-clinical-blue" />
                    <p className="text-xs text-clinical-slate">Analyzing clinical patterns...</p>
                  </div>
                ) : consultantAdvice ? (
                  <>
                    <section>
                      <label className="text-[10px] font-medium text-clinical-blue uppercase tracking-wide flex items-center gap-1.5 mb-2">
                        <Sparkles className="w-3 h-3" /> Expert Impression
                      </label>
                      <div className="p-4 bg-clinical-bg border-l-2 border-clinical-blue rounded-r-lg text-sm leading-relaxed text-clinical-ink italic">
                        "{consultantAdvice.advice}"
                      </div>
                    </section>
                    <section>
                      <label className="text-[10px] font-medium text-clinical-slate uppercase tracking-wide mb-2 block">Reasoning</label>
                      <p className="text-sm text-clinical-ink leading-relaxed">{consultantAdvice.reasoning}</p>
                    </section>
                    <section>
                      <label className="text-[10px] font-medium text-clinical-amber uppercase tracking-wide flex items-center gap-1.5 mb-2">
                        <Zap className="w-3 h-3" /> Recommended Actions
                      </label>
                      <div className="space-y-2">
                        {consultantAdvice.recommendedActions.map((action, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 bg-clinical-amber/5 border border-clinical-amber/10 rounded-lg">
                            <div className="w-5 h-5 rounded-full bg-clinical-amber text-white flex items-center justify-center text-[10px] font-medium shrink-0">{i + 1}</div>
                            <p className="text-xs text-clinical-ink mt-0.5">{action}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                    <div className="p-4 bg-clinical-blue/5 border border-clinical-blue/10 rounded-lg">
                      <p className="text-[10px] text-clinical-blue leading-relaxed">
                        <strong className="block mb-0.5">Disclaimer:</strong>
                        AI-generated for educational purposes. Always correlate with bedside presentation.
                      </p>
                    </div>
                  </>
                ) : (
                  <EmptyState icon={<Brain className="w-10 h-10" />} title="No advice generated" description="Request a consultation to get expert guidance." />
                )}
              </div>
              <div className="p-4 bg-clinical-bg border-t border-clinical-line">
                <button onClick={() => setIsConsultOpen(false)} className="w-full h-10 bg-clinical-ink text-white rounded-lg font-medium text-xs hover:bg-clinical-slate transition-all">Return to Patient</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
