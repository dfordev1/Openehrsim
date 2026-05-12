/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, Component, ErrorInfo, ReactNode } from 'react';
import {
  Activity,
  Clipboard,
  Stethoscope,
  FlaskConical,
  Plus,
  FileSearch,
  ChevronRight,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  History,
  Send,
  Loader2,
  Phone,
  MessageSquare,
  UserPlus,
  RefreshCw,
  Clock,
  Menu,
  X,
  Sparkles,
  Brain,
  PenTool,
  Zap,
  BookOpen,
  Pill,
  Command,
  Undo2,
  Moon,
  Sun,
  Maximize2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LineChart,
  Line,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { MedicalCase, Vitals, LabResult, ConsultantAdvice } from './types';
import { generateMedicalCase, evaluateDiagnosis, performIntervention, staffCall } from './services/geminiService';
import { getConsultantAdvice } from './services/aiConsultantService';
import { saveSimulationResult, getRecentSimulations } from './services/storageService';
import { getSupabase } from './lib/supabase';
import type { User } from './lib/supabase';
import { AuthModal } from './components/Auth';
import { ClinicalNotes } from './components/ClinicalNotes';
import { ClinicalGuidelines } from './components/ClinicalGuidelines';
import { ECGMonitor } from './components/ECGMonitor';
import { ClinicalVital } from './components/ClinicalVital';
import { NavTab } from './components/NavTab';
import { CaseLibrary } from './components/CaseLibrary';
import { ArchiveView } from './components/ArchiveView';
import { CommandPalette } from './components/CommandPalette';
import { EmptyState } from './components/EmptyState';
import { SkeletonCard, SkeletonVitals } from './components/Skeleton';
import { cn } from './lib/utils';
import { ToastProvider, useToast } from './components/Toast';
import VitalsExpanded from './components/VitalsExpanded';
import CaseExport from './components/CaseExport';
import { useUrlTab } from './hooks/useUrlTab';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useUndoStack } from './hooks/useUndoStack';
import { useDarkMode } from './hooks/useDarkMode';

// --- Error Boundary ---
interface ErrorBoundaryProps { children: ReactNode; }
interface ErrorBoundaryState { hasError: boolean; }

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(_: Error): ErrorBoundaryState { return { hasError: true }; }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) { console.error("UI Crash:", error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-clinical-bg flex items-center justify-center p-8">
          <div className="panel p-8 max-w-md text-center">
            <AlertCircle className="w-10 h-10 text-clinical-red mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-clinical-ink mb-2">Interface Disruption</h2>
            <p className="text-sm text-clinical-slate mb-6">The clinical dashboard encountered an error. Patient data remains intact.</p>
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

const GCS_MAPPING = {
  eyes: [
    { score: 4, label: 'Spontaneous', desc: 'Eyes open without stimulation' },
    { score: 3, label: 'To Speech', desc: 'Eyes open to name or command' },
    { score: 2, label: 'To Pain', desc: 'Eyes open to pressure stimulation' },
    { score: 1, label: 'None', desc: 'No eye opening' }
  ],
  verbal: [
    { score: 5, label: 'Oriented', desc: 'Correctly gives name, place, date' },
    { score: 4, label: 'Confused', desc: 'Not oriented but coherent' },
    { score: 3, label: 'Inappropriate', desc: 'Isolated words or phrases' },
    { score: 2, label: 'Incomprehensible', desc: 'Moans, groans, no words' },
    { score: 1, label: 'None', desc: 'No vocalization' }
  ],
  motor: [
    { score: 6, label: 'Obeys Commands', desc: 'Performs simple movements' },
    { score: 5, label: 'Localizes Pain', desc: 'Moves toward painful stimulus' },
    { score: 4, label: 'Withdraws', desc: 'Flexion withdrawal to pain' },
    { score: 3, label: 'Abnormal Flexion', desc: 'Decorticate posturing' },
    { score: 2, label: 'Extension', desc: 'Decerebrate posturing' },
    { score: 1, label: 'None', desc: 'No motor response' }
  ]
};




function ClinicalSimulator() {
  const { addToast } = useToast();
  const [medicalCase, setMedicalCase] = useState<MedicalCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useUrlTab();
  const [userDiagnosis, setUserDiagnosis] = useState('');
  const [consultantAdvice, setConsultantAdvice] = useState<ConsultantAdvice | null>(null);
  const [isConsulting, setIsConsulting] = useState(false);
  const [isConsultOpen, setIsConsultOpen] = useState(false);
  const [interventionInput, setInterventionInput] = useState('');
  const [feedback, setFeedback] = useState<{ score: number; feedback: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [intervening, setIntervening] = useState(false);
  const [calling, setCalling] = useState(false);
  const [callTarget, setCallTarget] = useState('Nursing Station');
  const [callMessage, setCallMessage] = useState('');
  const [vitalsHistory, setVitalsHistory] = useState<{ time: string; hr: number; sbp: number; rr: number; spo2: number }[]>([]);
  const [gcsState, setGcsState] = useState({ eyes: 4, verbal: 5, motor: 6 });
  const [revealedLabs, setRevealedLabs] = useState<string[]>([]);
  const [selectedLab, setSelectedLab] = useState<LabResult | null>(null);
  const [logs, setLogs] = useState<{ time: string; text: string }[]>([]);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isSupabaseConfigured, setIsSupabaseConfigured] = useState(true);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [customMedInput, setCustomMedInput] = useState('');
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [vitalsExpanded, setVitalsExpanded] = useState(false);

  // Dark mode
  const [isDark, toggleDark] = useDarkMode();

  // Undo/redo
  const { pushUndo, popUndo, canUndo, lastAction } = useUndoStack();

  const handleUndo = useCallback(() => {
    const entry = popUndo();
    if (entry) {
      setMedicalCase(entry.caseSnapshot);
      addToast(`Undid: ${entry.label}`, 'info');
    }
  }, [popUndo, addToast]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onTabChange: setActiveTab,
    onNewCase: () => setIsLibraryOpen(true),
    onDiagnosis: () => setActiveTab('assess'),
    onCommandPalette: () => setIsCommandOpen(prev => !prev),
    onUndo: handleUndo,
    enabled: !isCommandOpen && !isLibraryOpen && !isConsultOpen,
  });

  const toggleSection = (id: string) => setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));

  useEffect(() => {
    const supabase = getSupabase();
    setIsSupabaseConfigured(!!supabase);
    if (supabase) {
      supabase.auth.getUser().then(({ data: { user } }) => { setUser(user); });
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
      });
      return () => subscription.unsubscribe();
    }
  }, []);

  const handleLogout = async () => {
    const supabase = getSupabase();
    if (supabase) { await supabase.auth.signOut(); }
  };

  const handleConsult = async () => {
    if (!medicalCase) return;
    setIsConsulting(true);
    setIsConsultOpen(true);
    try {
      const advice = await getConsultantAdvice(medicalCase);
      setConsultantAdvice(advice);
      const updated = await performIntervention("Requested Specialty Consultation", medicalCase, 10);
      setMedicalCase(updated);
      setLogs(prev => [{ time: `T + ${updated.simulationTime}`, text: "Expert Consultation requested (+10 min)" }, ...prev]);
    } catch (err: any) {
      console.error(err);
      setError("Consultant is currently unavailable.");
    } finally {
      setIsConsulting(false);
    }
  };

  const calculateNEWS2 = (vitals?: Vitals): number => {
    if (!vitals) return 0;
    let score = 0;
    const rr = vitals.respiratoryRate;
    if (rr <= 8 || rr >= 25) score += 3;
    else if (rr >= 21) score += 2;
    else if (rr >= 9 && rr <= 11) score += 1;
    const spo2 = vitals.oxygenSaturation;
    if (spo2 <= 91) score += 3;
    else if (spo2 <= 93) score += 2;
    else if (spo2 <= 95) score += 1;
    const sys = parseInt(vitals.bloodPressure.split('/')[0]) || 120;
    if (sys <= 90 || sys >= 220) score += 3;
    else if (sys <= 100) score += 2;
    else if (sys <= 110) score += 1;
    const hr = vitals.heartRate;
    if (hr <= 40 || hr >= 131) score += 3;
    else if (hr >= 111 && hr <= 130) score += 2;
    else if (hr >= 91 && hr <= 110) score += 1;
    else if (hr >= 41 && hr <= 50) score += 1;
    const t = vitals.temperature;
    if (t <= 35.0) score += 3;
    else if (t >= 39.1) score += 2;
    else if (t >= 38.1 || (t >= 35.1 && t <= 36.0)) score += 1;
    return score;
  };

  useEffect(() => {
    if (medicalCase?.vitals) {
      setVitalsHistory(prev => {
        const sys = parseInt(medicalCase.vitals.bloodPressure.split('/')[0]) || 120;
        const newEntry = { time: `T+${medicalCase.simulationTime}`, hr: medicalCase.vitals.heartRate, sbp: sys, rr: medicalCase.vitals.respiratoryRate, spo2: medicalCase.vitals.oxygenSaturation };
        if (prev.length > 0 && prev[prev.length - 1].time === newEntry.time) return prev;
        return [...prev, newEntry].slice(-15);
      });
    }
  }, [medicalCase?.simulationTime, medicalCase?.vitals]);

  const STAFF_TARGETS = ['Nursing Station', 'Radiology Desk', 'Laboratory Tech', 'Cardiology Consult', 'Surgery Resident', 'ICU Attending', 'Pharmacy', 'Social Work'];

  const loadNewCase = useCallback(async (difficulty?: string, category?: string, environment?: string) => {
    setLoading(true); setError(null); setFeedback(null); setUserDiagnosis(''); setRevealedLabs([]);
    setLogs([{ time: new Date().toLocaleTimeString(), text: 'ADMIT: Patient registered in system.' }]);
    try {
      const history = await getRecentSimulations();
      const newCase = await generateMedicalCase(difficulty, category, history, environment);
      setMedicalCase(newCase);
      const hrBase = newCase.vitals?.heartRate || 75;
      const sysBase = parseInt(newCase.vitals?.bloodPressure.split('/')[0]) || 120;
      const rrBase = newCase.vitals?.respiratoryRate || 16;
      const spo2Base = newCase.vitals?.oxygenSaturation || 98;
      setVitalsHistory(Array.from({ length: 10 }, (_, i) => ({
        time: `T-${10-i}m`, hr: hrBase + (Math.random() * 4 - 2), sbp: sysBase + (Math.random() * 6 - 3),
        rr: rrBase + (Math.random() * 2 - 1), spo2: Math.min(100, spo2Base + (Math.random() * 1 - 0.5))
      })));
      setIsLibraryOpen(false);
    } catch (error) {
      console.error("Failed to generate case:", error);
      setError(error instanceof Error ? error.message : "Clinical database connection failure.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadNewCase(); }, [loadNewCase]);

  useEffect(() => {
    if (!medicalCase) return;
    const interval = setInterval(() => {
      setVitalsHistory(prev => {
        const last = prev[prev.length - 1];
        if (!last) return prev;
        return [...prev.slice(1), {
          time: new Date().toLocaleTimeString(),
          hr: (medicalCase?.vitals?.heartRate || 75) + (Math.random() * 2 - 1),
          sbp: last.sbp + (Math.random() * 1 - 0.5),
          rr: last.rr + (Math.random() * 0.4 - 0.2),
          spo2: Math.min(100, last.spo2 + (Math.random() * 0.2 - 0.1))
        }];
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [medicalCase]);

  const handlePerformIntervention = async (customWait?: number, directIntervention?: string) => {
    if (!medicalCase) return;
    const interventionToExecute = directIntervention || interventionInput || "Observation";
    pushUndo(`Intervention: ${interventionToExecute}`, medicalCase);
    setIntervening(true);
    setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), text: directIntervention ? `ACTION: ${directIntervention}` : (customWait ? `WAIT ${customWait} min` : `ORDER: ${interventionInput}`) }]);
    try {
      const updatedCase = await performIntervention(interventionToExecute, medicalCase, customWait || 5);
      setMedicalCase(prev => {
        if (!prev) return updatedCase;
        return { ...prev, ...updatedCase, labs: updatedCase.labs || prev.labs, imaging: updatedCase.imaging || prev.imaging, clinicalActions: updatedCase.clinicalActions || prev.clinicalActions, vitals: { ...prev.vitals, ...(updatedCase.vitals || {}) } };
      });
      setInterventionInput('');
      addToast(`Intervention executed: ${interventionToExecute}`, 'success');
    } catch (error) { console.error("Intervention failed:", error); }
    finally { setIntervening(false); }
  };

  const handleSubmitDiagnosis = async () => {
    if (!medicalCase || !userDiagnosis) return;
    setSubmitting(true);
    try {
      const result = await evaluateDiagnosis(userDiagnosis, medicalCase);
      setFeedback(result);
      setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), text: `DIAGNOSIS FILED: ${userDiagnosis}` }]);
      saveSimulationResult(medicalCase, userDiagnosis, result.score, result.feedback).catch(err => console.error("Persistence failed:", err));
      addToast(`Diagnosis submitted — Score: ${result.score}/100`, 'success');
    } catch (error) { console.error("Failed to evaluate diagnosis:", error); }
    finally { setSubmitting(false); }
  };

  const handleStaffCall = async () => {
    if (!medicalCase || !callMessage) return;
    pushUndo(`Call: ${callTarget}`, medicalCase);
    setCalling(true);
    try {
      const { reply, updatedCase } = await staffCall(callTarget, callMessage, medicalCase);
      setMedicalCase(updatedCase);
      setCallMessage('');
      setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), text: `COMM: Call to ${callTarget} - "${reply.slice(0, 30)}..."` }]);
      addToast(`Staff call to ${callTarget} completed`, 'success');
    } catch (err) { console.error(err); }
    finally { setCalling(false); }
  };

  const handleOrderDiagnostic = async (type: 'lab' | 'imaging', name: string) => {
    if (!medicalCase) return;
    setIntervening(true);
    setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), text: `ORDERED: ${name}` }]);
    try {
      const updatedCase = await performIntervention(`Order ${type}: ${name}`, medicalCase, 1);
      setMedicalCase(updatedCase);
      addToast(`Lab ordered: ${name}`, 'success');
    } catch (err) { console.error(err); }
    finally { setIntervening(false); }
  };

  // --- Loading / Error States with Skeletons ---
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
              <div className="flex justify-center mb-4">
                <Loader2 className="w-6 h-6 animate-spin text-clinical-blue" />
              </div>
              <SkeletonVitals />
              <SkeletonCard />
              <p className="text-xs text-clinical-slate text-center">Synchronizing clinical data...</p>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  const simTime = medicalCase?.simulationTime || 0;

  const primaryTabs = [
    { id: 'hpi', icon: <Clipboard className="w-4 h-4" />, label: 'History' },
    { id: 'exam', icon: <Stethoscope className="w-4 h-4" />, label: 'Exam' },
    { id: 'labs', icon: <FlaskConical className="w-4 h-4" />, label: 'Labs' },
    { id: 'imaging', icon: <FileSearch className="w-4 h-4" />, label: 'Imaging' },
  ];

  const actionTabs = [
    { id: 'pharmacy', icon: <Pill className="w-4 h-4" />, label: 'Pharmacy' },
    { id: 'treatment', icon: <Activity className="w-4 h-4" />, label: 'Orders' },
    { id: 'comms', icon: <Phone className="w-4 h-4" />, label: 'Comms' },
  ];

  const toolTabs = [
    { id: 'assess', icon: <CheckCircle2 className="w-4 h-4" />, label: 'Assessment' },
    { id: 'notes', icon: <PenTool className="w-4 h-4" />, label: 'Notes' },
    { id: 'tools', icon: <BookOpen className="w-4 h-4" />, label: 'Guidelines' },
    ...(user ? [{ id: 'archive', icon: <History className="w-4 h-4" />, label: 'Archive' }] : [])
  ];

  const mobileNavTabs = [
    { id: 'hpi', icon: <Clipboard className="w-4 h-4" />, label: 'HPI' },
    { id: 'labs', icon: <FlaskConical className="w-4 h-4" />, label: 'Labs' },
    { id: 'treatment', icon: <Activity className="w-4 h-4" />, label: 'Orders' },
    { id: 'assess', icon: <CheckCircle2 className="w-4 h-4" />, label: 'Assess' },
    { id: 'comms', icon: <Phone className="w-4 h-4" />, label: 'Comms' },
  ];



  return (
    <div className="h-screen bg-clinical-bg flex flex-col overflow-hidden text-clinical-ink" role="application" aria-label="Clinical Simulator">
      {/* Vitals Expanded Modal */}
      <VitalsExpanded isOpen={vitalsExpanded} onClose={() => setVitalsExpanded(false)} vitalsHistory={vitalsHistory} />

      {!isSupabaseConfigured && (
        <div className="bg-amber-50/80 border-b border-amber-100 py-1.5 px-4 text-xs text-amber-700 z-50">
          History disabled — Supabase not configured
        </div>
      )}

      {/* Focus trap handled internally by CaseLibrary */}
      <CaseLibrary isOpen={isLibraryOpen} onClose={() => setIsLibraryOpen(false)} onSelectCase={(diff, cat, env) => loadNewCase(diff, cat, env)} />
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      {/* Focus trap handled internally by CommandPalette */}
      <CommandPalette
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        onNavigate={(tab) => setActiveTab(tab as any)}
        onNewCase={() => setIsLibraryOpen(true)}
        onConsult={handleConsult}
        hasArchive={!!user}
      />

      {/* Header */}
      <header className="h-11 bg-clinical-surface border-b border-clinical-line flex items-center px-4 shrink-0 z-30" role="banner">
        <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-1.5 hover:bg-clinical-bg rounded-md mr-3" aria-label="Menu">
          <Menu className="w-4 h-4 text-clinical-slate" />
        </button>
        <span className="text-sm font-semibold text-clinical-ink mr-3 hidden sm:inline tracking-tight">OpenEHR</span>
        <div className="flex items-center gap-2 text-sm text-clinical-slate flex-1 min-w-0">
          <span className="font-medium text-clinical-ink truncate">{medicalCase?.patientName}</span>
          <span className="text-xs text-clinical-slate/50 hidden md:inline">{medicalCase?.currentLocation}</span>
        </div>
        <div className="flex items-center gap-3 ml-auto">
          {/* Dark mode toggle */}
          <button onClick={toggleDark} className="p-1.5 hover:bg-clinical-bg rounded-md transition-colors" aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
            {isDark ? <Sun className="w-3.5 h-3.5 text-clinical-slate" /> : <Moon className="w-3.5 h-3.5 text-clinical-slate" />}
          </button>
          {/* Command palette trigger */}
          <button onClick={() => setIsCommandOpen(true)} className="hidden sm:flex items-center gap-1.5 text-xs text-clinical-slate/60 hover:text-clinical-slate bg-clinical-bg border border-clinical-line rounded-md px-2.5 py-1 transition-colors" aria-label="Command palette">
            <Command className="w-3 h-3" />
            <span className="font-mono text-[10px]">K</span>
          </button>
          <span className="text-xs font-mono text-clinical-blue/80">T+{simTime}m</span>
          <button onClick={() => setIsLibraryOpen(true)} className="text-clinical-slate/50 hover:text-clinical-blue transition-colors" aria-label="New case">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          {user ? (
            <button onClick={handleLogout} className="w-6 h-6 bg-clinical-blue/80 rounded-full flex items-center justify-center text-[9px] font-medium text-white" aria-label="Account">{user.email?.[0]}</button>
          ) : (
            <button onClick={() => setIsAuthOpen(true)} className="text-xs text-clinical-blue font-medium hover:underline" aria-label="Sign in">Sign in</button>
          )}
        </div>
      </header>

      {/* Alarm Banner */}
      <AnimatePresence>
        {(medicalCase?.activeAlarms || []).length > 0 && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-red-50/60 border-b border-red-100/80 py-1.5 px-4 flex items-center gap-3 overflow-hidden shrink-0" role="alert" aria-live="assertive">
            <div className="w-1.5 h-1.5 bg-clinical-red/70 rounded-full animate-pulse shrink-0" />
            <div className="flex gap-3 text-xs text-clinical-red/80 font-medium overflow-x-auto no-scrollbar">
              {medicalCase?.activeAlarms.map((alarm, i) => (<span key={i}>{alarm}</span>))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Vitals Rail with sparklines and expand */}
      <div className="h-11 bg-clinical-surface border-b border-clinical-line/50 flex items-center px-4 gap-3 shrink-0 overflow-x-auto no-scrollbar" role="region" aria-label="Vital signs">
        <div className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", medicalCase?.physiologicalTrend === 'improving' ? "text-clinical-green bg-green-50/80" : medicalCase?.physiologicalTrend === 'declining' ? "text-clinical-amber bg-amber-50/80" : medicalCase?.physiologicalTrend === 'critical' ? "text-clinical-red bg-red-50/80" : "text-clinical-slate bg-slate-50")}>
          {medicalCase?.physiologicalTrend}
        </div>
        <div className="w-px h-5 bg-clinical-line/50" />
        <ClinicalVital label="HR" value={Math.round(vitalsHistory[vitalsHistory.length - 1]?.hr || medicalCase?.vitals?.heartRate || 0)} unit="bpm" status="normal" isAlarming={medicalCase?.activeAlarms.some(a => a.includes('HR') || a.includes('Pulse') || a.includes('Bradycardia') || a.includes('Tachycardia'))} trend={vitalsHistory.map(v => v.hr)} onClick={() => setVitalsExpanded(true)} />
        <ClinicalVital label="BP" value={medicalCase?.vitals?.bloodPressure || '--'} unit="mmHg" status="normal" isAlarming={medicalCase?.activeAlarms.some(a => a.includes('BP') || a.includes('Pressure') || a.includes('Hypotension') || a.includes('Hypertension'))} trend={vitalsHistory.map(v => v.sbp)} onClick={() => setVitalsExpanded(true)} />
        <ClinicalVital label="SpO2" value={medicalCase?.vitals?.oxygenSaturation || 0} unit="%" status="normal" isAlarming={medicalCase?.activeAlarms.some(a => a.includes('SpO2') || a.includes('Saturation') || a.includes('Hypoxia'))} trend={vitalsHistory.map(v => v.spo2)} onClick={() => setVitalsExpanded(true)} />
        <ClinicalVital label="RR" value={medicalCase?.vitals?.respiratoryRate || '--'} unit="/min" status="normal" isAlarming={medicalCase?.activeAlarms.some(a => a.includes('RR') || a.includes('Respiratory'))} trend={vitalsHistory.map(v => v.rr)} onClick={() => setVitalsExpanded(true)} />
        <ClinicalVital label="Temp" value={medicalCase?.vitals?.temperature || 0} unit="°C" status="normal" isAlarming={medicalCase?.activeAlarms.some(a => a.includes('Temp') || a.includes('Temperature') || a.includes('Fever'))} onClick={() => setVitalsExpanded(true)} />
        <button onClick={() => setVitalsExpanded(true)} className="ml-auto p-1 hover:bg-clinical-bg rounded transition-colors shrink-0" aria-label="Expand vitals">
          <Maximize2 className="w-3.5 h-3.5 text-clinical-slate/50" />
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile Navigation Drawer */}
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
                  <div>
                    <p className="text-[10px] font-semibold text-clinical-slate/60 uppercase tracking-wider px-3 mb-1">Patient Data</p>
                    {primaryTabs.map(tab => (<NavTab key={tab.id} active={activeTab === tab.id} icon={tab.icon} label={tab.label} onClick={() => { setActiveTab(tab.id as any); setIsSidebarOpen(false); }} />))}
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-clinical-slate/60 uppercase tracking-wider px-3 mb-1">Actions</p>
                    {actionTabs.map(tab => (<NavTab key={tab.id} active={activeTab === tab.id} icon={tab.icon} label={tab.label} onClick={() => { setActiveTab(tab.id as any); setIsSidebarOpen(false); }} />))}
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-clinical-slate/60 uppercase tracking-wider px-3 mb-1">Tools</p>
                    {toolTabs.map(tab => (<NavTab key={tab.id} active={activeTab === tab.id} icon={tab.icon} label={tab.label} onClick={() => { setActiveTab(tab.id as any); setIsSidebarOpen(false); }} />))}
                  </div>
                </nav>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Desktop Sidebar */}
        <nav className="w-48 bg-clinical-surface border-r border-clinical-line/50 flex-col py-3 px-2 z-20 shrink-0 hidden lg:flex" aria-label="Main navigation">
          <div className="space-y-4 flex-1">
            <div>
              <p className="text-[10px] font-semibold text-clinical-slate/50 uppercase tracking-wider px-3 mb-1">Patient Data</p>
              <div className="space-y-0.5">
                {primaryTabs.map(tab => (<NavTab key={tab.id} active={activeTab === tab.id} icon={tab.icon} label={tab.label} onClick={() => setActiveTab(tab.id as any)} />))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-clinical-slate/50 uppercase tracking-wider px-3 mb-1">Actions</p>
              <div className="space-y-0.5">
                {actionTabs.map(tab => (<NavTab key={tab.id} active={activeTab === tab.id} icon={tab.icon} label={tab.label} onClick={() => setActiveTab(tab.id as any)} />))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-clinical-slate/50 uppercase tracking-wider px-3 mb-1">Tools</p>
              <div className="space-y-0.5">
                {toolTabs.map(tab => (<NavTab key={tab.id} active={activeTab === tab.id} icon={tab.icon} label={tab.label} onClick={() => setActiveTab(tab.id as any)} />))}
              </div>
            </div>
          </div>
          <div className="pt-3 px-1 border-t border-clinical-line/50">
            <button onClick={handleConsult} disabled={isConsulting || !medicalCase} className="w-full py-2 px-3 text-xs font-medium text-clinical-slate hover:text-clinical-blue hover:bg-clinical-blue/5 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-40" aria-label="AI Consultant">
              {isConsulting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              AI Consultant
            </button>
          </div>
        </nav>




        {/* Clinical Workspace */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-5 flex flex-col gap-4 pb-20 lg:pb-5" role="main" aria-label="Clinical workspace">
          <AnimatePresence mode="wait">
            {activeTab === 'hpi' && (
              <motion.div key="hpi" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="panel">
                <div className="panel-header">
                  <span className="panel-title">Intake Documentation</span>
                  <span className="text-[10px] text-clinical-slate/50">{medicalCase?.currentLocation}</span>
                </div>
                <div className="p-5 space-y-6">
                  <section>
                    <label className="text-[10px] font-medium text-clinical-slate uppercase block mb-1.5">Chief Complaint</label>
                    <p className="text-lg font-medium text-clinical-ink leading-snug">"{medicalCase?.chiefComplaint}"</p>
                  </section>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <section>
                      <label className="text-[10px] font-medium text-clinical-slate uppercase block mb-2 border-b border-clinical-line/50 pb-1">Clinical History (HPI)</label>
                      <p className="text-sm text-clinical-ink leading-relaxed whitespace-pre-wrap">{medicalCase?.historyOfPresentIllness}</p>
                    </section>
                    <section>
                      <label className="text-[10px] font-medium text-clinical-slate uppercase block mb-2 border-b border-clinical-line/50 pb-1">Past Medical History</label>
                      <div className="space-y-1.5">
                        {(medicalCase?.pastMedicalHistory || []).map((m, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm text-clinical-ink"><div className="w-1 h-1 bg-clinical-slate/30 rounded-full shrink-0" />{m}</div>
                        ))}
                      </div>
                    </section>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'exam' && (
              <motion.div key="exam" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
                {/* GCS */}
                <div className="panel">
                  <button onClick={() => toggleSection('gcs')} className="panel-header w-full cursor-pointer hover:bg-clinical-bg/60 transition-colors">
                    <span className="panel-title">Glasgow Coma Scale (GCS)</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono font-semibold text-clinical-blue">E{gcsState.eyes} V{gcsState.verbal} M{gcsState.motor} = {gcsState.eyes + gcsState.verbal + gcsState.motor}</span>
                      <ChevronRight className={cn("w-4 h-4 text-clinical-slate/40 transition-transform", expandedSections['gcs'] && "rotate-90")} />
                    </div>
                  </button>
                  {expandedSections['gcs'] && (
                    <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                      {(['eyes', 'verbal', 'motor'] as const).map(category => (
                        <div key={category} className="space-y-2" role="radiogroup" aria-label={`${category} response`}>
                          <label className="text-[10px] font-medium text-clinical-slate uppercase tracking-wide">{category} Response</label>
                          <div className="flex flex-col gap-1">
                            {GCS_MAPPING[category].map(option => (
                              <button key={option.score} onClick={() => setGcsState(prev => ({ ...prev, [category]: option.score }))} role="radio" aria-checked={gcsState[category] === option.score} className={cn("text-left p-2.5 rounded-md text-xs transition-all border", gcsState[category] === option.score ? "bg-clinical-blue/10 text-clinical-blue border-clinical-blue/30 font-medium" : "bg-clinical-surface border-clinical-line hover:border-clinical-blue/20 text-clinical-ink")}>
                                <div className="flex justify-between items-center">
                                  <span>{option.label}</span>
                                  <span className="text-[10px] font-mono text-clinical-slate/50">{option.score}</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="panel">
                  <div className="panel-header"><span className="panel-title">Physical Examination</span></div>
                  <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                    {Object.entries(medicalCase?.physicalExam || {}).map(([key, val]) => (
                      <div key={key} className="space-y-1">
                        <h4 className="text-[10px] font-medium text-clinical-slate uppercase">{key}</h4>
                        <div className="p-2.5 bg-clinical-bg/50 border-l-2 border-clinical-line text-sm text-clinical-ink">{val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'labs' && (
              <motion.div key="labs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4 flex-1 min-h-0">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
                  <div className="lg:col-span-2 panel flex flex-col min-h-[300px]">
                    <div className="panel-header">
                      <span className="panel-title">Clinical Chemistry & Hematology</span>
                      <span className="text-[10px] text-clinical-slate/50 hidden sm:inline">Specimen: Whole Blood / Plasma</span>
                    </div>
                    <div className="flex-1 overflow-auto">
                      <table className="clinical-table w-full" aria-label="Lab results">
                        <thead className="sticky top-0 bg-clinical-surface z-10">
                          <tr><th scope="col">Test</th><th scope="col">Value</th><th scope="col">Status</th><th scope="col">Reference</th><th className="w-8"></th></tr>
                        </thead>
                        <tbody>
                          {(medicalCase?.labs || []).map((lab) => {
                            const isAvailable = lab.orderedAt !== undefined && lab.availableAt !== undefined && lab.availableAt <= simTime;
                            const isPending = lab.orderedAt !== undefined && (lab.availableAt === undefined || lab.availableAt > simTime);
                            return (
                              <tr key={lab.name} onClick={() => isAvailable && setSelectedLab(lab)} className={cn("transition-colors cursor-pointer", selectedLab?.name === lab.name ? "bg-clinical-blue/5" : "hover:bg-clinical-bg/50")}>
                                <td className="font-medium text-clinical-ink">{lab.name}</td>
                                <td className="font-mono text-sm">{isAvailable ? (<span className={cn(lab.status === 'critical' ? 'text-clinical-red font-semibold' : lab.status === 'abnormal' ? 'text-clinical-amber' : '')}>{lab.value}</span>) : <span className="opacity-20">---</span>}</td>
                                <td>{!lab.orderedAt ? (<button onClick={(e) => { e.stopPropagation(); handleOrderDiagnostic('lab', lab.name); }} className="text-[10px] font-medium text-clinical-blue hover:underline">[Order]</button>) : isPending ? (<span className="text-[10px] font-medium text-clinical-amber animate-pulse">Pending...</span>) : (<div className="flex items-center gap-1.5"><div className={cn("w-1.5 h-1.5 rounded-full", lab.status === 'critical' ? 'bg-clinical-red' : lab.status === 'abnormal' ? 'bg-clinical-amber' : 'bg-clinical-green')} /><span className="text-[10px] text-clinical-slate/60 capitalize">{lab.status}</span></div>)}</td>
                                <td className="text-xs text-clinical-slate/70">{lab.normalRange} {lab.unit}</td>
                                <td>{isAvailable && <ChevronRight className="w-3 h-3 opacity-30" />}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="lg:col-span-1 panel flex flex-col min-h-[250px]">
                    <div className="panel-header"><span className="panel-title">Interpretation</span></div>
                    <div className="flex-1 p-4 overflow-y-auto">
                      {selectedLab ? (
                        <div className="space-y-4 animate-in fade-in">
                          <div><h4 className="text-[10px] font-medium text-clinical-slate uppercase mb-1">Component</h4><p className="text-base font-semibold">{selectedLab.name}</p></div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-clinical-bg/50 p-3 rounded-md"><h5 className="text-[9px] font-medium text-clinical-slate uppercase mb-1">Current</h5><p className="font-mono text-lg font-semibold">{selectedLab.value}</p></div>
                            <div className="bg-clinical-bg/50 p-3 rounded-md"><h5 className="text-[9px] font-medium text-clinical-slate uppercase mb-1">Status</h5><p className={cn("text-xs font-medium capitalize", selectedLab.status === 'critical' ? "text-clinical-red" : selectedLab.status === 'abnormal' ? "text-clinical-amber" : "text-clinical-green")}>{selectedLab.status}</p></div>
                          </div>
                          <div><h4 className="text-[10px] font-medium text-clinical-slate uppercase mb-2">Comments</h4><p className="text-xs text-clinical-ink leading-relaxed border-l-2 border-clinical-blue/20 pl-3">{selectedLab.clinicalNote || "No morphological abnormalities noted."}</p></div>
                          <div className="pt-3 space-y-1.5 text-[10px] text-clinical-slate border-t border-clinical-line/50">
                            <div className="flex justify-between"><span>Ordered:</span><span className="font-mono">T+{selectedLab.orderedAt}m</span></div>
                            <div className="flex justify-between"><span>Verified:</span><span className="font-mono text-clinical-green">T+{selectedLab.availableAt}m</span></div>
                          </div>
                        </div>
                      ) : (
                        <EmptyState icon={<FlaskConical className="w-10 h-10" />} title="Select a lab result" description="Click on a test row to view interpretation." />
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'imaging' && (
              <motion.div key="imaging" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4 flex-1 min-h-0">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
                  <div className="lg:col-span-1 panel flex flex-col min-h-[200px] max-h-[500px] lg:max-h-none">
                    <div className="panel-header"><span className="panel-title">Imaging Worklist</span></div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                      {medicalCase?.imaging.map((img, i) => {
                        const isAvailable = img.orderedAt !== undefined && img.availableAt !== undefined && img.availableAt <= simTime;
                        const isPending = img.orderedAt !== undefined && (img.availableAt === undefined || img.availableAt > simTime);
                        return (
                          <button key={i} onClick={() => isAvailable && setRevealedLabs(prev => [...prev, img.type])} className={cn("w-full text-left p-3 rounded-md border transition-all flex flex-col gap-1", revealedLabs.includes(img.type) ? "bg-clinical-blue/10 text-clinical-blue border-clinical-blue/30" : "bg-clinical-surface border-clinical-line hover:border-clinical-blue/30", isPending && "bg-clinical-bg opacity-70", !img.orderedAt && "opacity-50")}>
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-medium">{img.type}</span>
                              {isAvailable ? <div className="w-1.5 h-1.5 bg-clinical-green rounded-full" /> : isPending ? <Clock className="w-3 h-3 text-clinical-amber animate-spin" /> : <div className="w-1.5 h-1.5 bg-clinical-slate/30 rounded-full" />}
                            </div>
                            <div className="text-[10px] text-clinical-slate/60 flex justify-between"><span>{isAvailable ? "Completed" : isPending ? "Pending..." : "Unordered"}</span>{img.orderedAt && <span>T+{img.orderedAt}m</span>}</div>
                            {!img.orderedAt && <span onClick={(e) => { e.stopPropagation(); handleOrderDiagnostic('imaging', img.type); }} className="mt-1 text-[10px] text-clinical-blue font-medium hover:underline">Place Order</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="lg:col-span-2 bg-[var(--color-panel-dark)] border border-[var(--color-panel-dark-border)] rounded-lg flex flex-col overflow-hidden text-slate-300 min-h-[300px]">
                    <div className="bg-[#161820] p-2.5 border-b border-[var(--color-panel-dark-border)] flex items-center justify-between px-4">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">DICOM Viewer</span>
                      <div className="flex gap-1.5"><div className="w-2 h-2 rounded-full bg-red-400/40" /><div className="w-2 h-2 rounded-full bg-amber-400/40" /><div className="w-2 h-2 rounded-full bg-green-400/40" /></div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-5 space-y-4">
                      {medicalCase?.imaging.find(img => revealedLabs.includes(img.type)) ? (
                        (() => {
                          const img = medicalCase.imaging.find(img => revealedLabs.includes(img.type))!;
                          return (
                            <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in">
                              <div className="border-b border-slate-700/50 pb-3">
                                <h1 className="text-lg font-semibold text-white">{img.type}</h1>
                                <p className="text-[10px] text-slate-500">TECHNIQUE: {img.technique || 'Standard protocol with IV contrast'}</p>
                              </div>
                              <section><h2 className="text-[10px] font-medium text-clinical-blue uppercase tracking-wide mb-2">Findings</h2><p className="text-sm border-l-2 border-slate-700 pl-4 leading-relaxed text-slate-400 whitespace-pre-line">{img.findings || "Reviewing data sequences..."}</p></section>
                              <section className="bg-slate-800/50 p-4 rounded-lg border border-clinical-blue/20"><h2 className="text-[10px] font-medium text-clinical-red uppercase tracking-wide mb-2">Impression</h2><p className="text-sm font-medium text-white">{img.impression || "Final report pending."}</p></section>
                            </div>
                          );
                        })()
                      ) : (
                        <EmptyState icon={<FileSearch className="w-10 h-10" />} title="Awaiting selection" description="Select a completed study from the worklist." />
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}




            {activeTab === 'pharmacy' && (
              <motion.div key="pharmacy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4 flex-1 min-h-0">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1">
                  <div className="panel flex flex-col">
                    <div className="panel-header"><span className="panel-title">Stat Medication Catalog</span></div>
                    <div className="panel-body space-y-4 overflow-y-auto flex-1">
                      {[
                        { cat: 'Resuscitation', meds: ['Epinephrine 1mg', 'Amiodarone 300mg', 'Atropine 1mg'] },
                        { cat: 'Fluids / Volume', meds: ['NS 1L Bolus', 'LR 500mL', 'Albumin 25%'] },
                        { cat: 'Analgesia / Sedation', meds: ['Fentanyl 50mcg', 'Propofol 20mg', 'Morphine 4mg'] },
                        { cat: 'Cardiovascular', meds: ['Nitroglycerin 0.4mg SL', 'Aspirin 324mg PO', 'Heparin 5000u Bolus'] }
                      ].map((group, idx) => (
                        <div key={idx} className="space-y-1.5">
                          <label className="text-[10px] font-medium text-clinical-slate/60 uppercase">{group.cat}</label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1.5">
                            {group.meds.map(med => (
                              <button key={med} onClick={() => handlePerformIntervention(2, `Administer ${med}`)} disabled={intervening} className="flex justify-between items-center p-2.5 bg-clinical-bg/50 border border-clinical-line rounded-md hover:border-clinical-blue/30 hover:bg-clinical-blue/5 transition-all text-xs disabled:opacity-50">
                                <span>{med}</span>
                                <Plus className="w-3 h-3 text-clinical-blue/60" />
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="panel flex flex-col">
                    <div className="panel-header"><span className="panel-title">Custom Order</span></div>
                    <div className="panel-body flex-1 flex flex-col items-center justify-center">
                      <Pill className="w-8 h-8 text-clinical-slate/20 mb-3" />
                      <p className="text-xs font-medium text-clinical-slate mb-3">Custom Pharmacy Order</p>
                      <div className="w-full flex gap-2">
                        <input type="text" value={customMedInput} onChange={(e) => setCustomMedInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && customMedInput) { handlePerformIntervention(2, `Administer ${customMedInput}`); setCustomMedInput(''); } }} placeholder="Drug name & dose..." className="flex-1 bg-clinical-bg border border-clinical-line rounded-md p-2 text-xs focus:outline-none focus:border-clinical-blue/50 focus:ring-1 focus:ring-clinical-blue/30" />
                        <button onClick={() => { if (customMedInput) { handlePerformIntervention(2, `Administer ${customMedInput}`); setCustomMedInput(''); } }} disabled={!customMedInput || intervening} className="bg-clinical-blue text-white px-3 py-2 rounded-md text-xs font-medium disabled:opacity-50">Give</button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'comms' && (
              <motion.div key="comms" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4 flex-1 min-h-0">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
                  <div className="md:col-span-1 panel">
                    <div className="panel-header"><span className="panel-title">Directory</span></div>
                    <div className="p-3 space-y-0.5 max-h-[200px] overflow-y-auto" role="listbox" aria-label="Staff contacts">
                      {STAFF_TARGETS.map(target => (
                        <button key={target} onClick={() => setCallTarget(target)} role="option" aria-selected={callTarget === target} className={cn("w-full text-left px-3 py-2 rounded-md text-xs transition-colors", callTarget === target ? "bg-clinical-blue/10 text-clinical-blue font-medium" : "text-clinical-slate hover:bg-clinical-bg")}>
                          {target}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="md:col-span-2 panel">
                    <div className="panel-header"><span className="panel-title">Call: {callTarget}</span></div>
                    <div className="p-4">
                      <div className="flex gap-2">
                        <input type="text" value={callMessage} onChange={(e) => setCallMessage(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleStaffCall()} placeholder={`Message for ${callTarget}...`} className="flex-1 bg-clinical-bg border border-clinical-line rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-clinical-blue/50 focus:ring-1 focus:ring-clinical-blue/30 transition-all" />
                        <button onClick={handleStaffCall} disabled={calling || !callMessage} className="px-4 bg-clinical-blue text-white rounded-md font-medium text-xs hover:bg-clinical-blue/90 transition-all disabled:opacity-50 flex items-center gap-2">
                          {calling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex-1 panel flex flex-col min-h-[250px]">
                  <div className="panel-header"><span className="panel-title">Interaction History</span></div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-clinical-bg/30">
                    {(medicalCase?.communicationLog || []).length === 0 ? (
                      <EmptyState icon={<MessageSquare className="w-10 h-10" />} title="No messages yet" description="Send a message to start communication." />
                    ) : (
                      medicalCase.communicationLog.map((msg, i) => (
                        <div key={i} className={cn("max-w-[80%] flex flex-col gap-1", msg.from === 'You' || msg.from === 'Physician' ? "ml-auto items-end" : "mr-auto items-start")}>
                          <div className="text-[9px] font-medium text-clinical-slate px-1">{msg.from} → {msg.to}</div>
                          <div className={cn("p-3 rounded-lg text-sm", msg.from === 'You' || msg.from === 'Physician' ? "bg-clinical-blue text-white rounded-tr-sm" : "bg-clinical-surface border border-clinical-line rounded-tl-sm text-clinical-ink")}>{msg.message}</div>
                          <div className="text-[9px] text-clinical-slate/50 font-mono px-1">T+{msg.timestamp}m</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'treatment' && (
              <motion.div key="treatment" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div className="panel">
                    <div className="panel-header"><span className="panel-title">Electronic Order Entry (CPOE)</span></div>
                    <div className="panel-body">
                      <textarea value={interventionInput} onChange={(e) => setInterventionInput(e.target.value)} placeholder="Order: med, dose, route, frequency..." className="w-full h-24 bg-clinical-bg border border-clinical-line rounded-md p-3 text-sm focus:outline-none focus:border-clinical-blue/50 focus:ring-1 focus:ring-clinical-blue/30 transition-all resize-none" />
                      <div className="mt-3 flex gap-2">
                        <button onClick={() => handlePerformIntervention()} disabled={intervening || !interventionInput} className="flex-1 py-2.5 bg-clinical-ink text-white rounded-md font-medium text-xs hover:bg-clinical-slate transition-all disabled:opacity-30">Execute Order</button>
                        <button onClick={() => handlePerformIntervention(10)} disabled={intervening} className="px-4 border border-clinical-line text-clinical-slate rounded-md text-xs font-medium hover:bg-clinical-bg transition-all">Wait 10m</button>
                      </div>
                    </div>
                  </div>
                  <div className="panel">
                    <div className="panel-header"><span className="panel-title">Medication Administration (MAR)</span></div>
                    <div className="panel-body">
                      <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
                        {(medicalCase?.medications || []).length === 0 ? (
                          <div className="py-6 text-center text-xs text-clinical-slate/50">No medications administered</div>
                        ) : (
                          medicalCase?.medications.map((med, i) => (
                            <div key={i} className="flex items-center justify-between p-2.5 bg-clinical-bg/50 border border-clinical-line/50 rounded-md text-xs">
                              <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-clinical-blue/60 rounded-full" /><span className="font-medium">{med.name}</span><span className="text-clinical-slate/60">{med.dose || '-'} {med.route ? `via ${med.route}` : ''}</span></div>
                              <span className="font-mono text-[10px] text-clinical-slate">T+{med.timestamp}m</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Transfer section */}
                  <div className="panel">
                    <button onClick={() => toggleSection('transfer')} className="panel-header w-full cursor-pointer hover:bg-clinical-bg/60 transition-colors">
                      <span className="panel-title">Transfer / Timing</span>
                      <ChevronRight className={cn("w-4 h-4 text-clinical-slate/40 transition-transform", expandedSections['transfer'] && "rotate-90")} />
                    </button>
                    {expandedSections['transfer'] && (
                      <div className="panel-body space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          {['ICU', 'OR / Surgery', 'Cath Lab', 'General Ward', 'Radiology'].map(dept => (
                            <button key={dept} onClick={() => handlePerformIntervention(0, `Transfer to ${dept}`)} disabled={intervening} className="py-2 px-3 border border-clinical-line rounded-md text-[10px] font-medium text-clinical-slate hover:bg-clinical-blue hover:text-white hover:border-clinical-blue transition-all flex items-center gap-1.5 disabled:opacity-50">
                              <UserPlus className="w-3 h-3 shrink-0" /><span className="truncate">{dept}</span>
                            </button>
                          ))}
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-clinical-line/50">
                          <button onClick={() => handlePerformIntervention(15, 'Observe patient')} disabled={intervening} className="py-2 px-3 border border-clinical-line rounded-md text-[10px] font-medium text-clinical-slate hover:bg-clinical-ink hover:text-white transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"><Clock className="w-3 h-3" />Wait 15m</button>
                          <button onClick={() => handlePerformIntervention(60, 'Periodic monitoring')} disabled={intervening} className="py-2 px-3 border border-clinical-line rounded-md text-[10px] font-medium text-clinical-slate hover:bg-clinical-ink hover:text-white transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"><Clock className="w-3 h-3" />Wait 1h</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-4">
                  {/* Vitals trend chart */}
                  <div className="panel">
                    <div className="panel-header"><span className="panel-title">HR Trend Monitor</span></div>
                    <div className="p-4 h-36">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={vitalsHistory}>
                          <Line type="monotone" dataKey="hr" stroke="var(--color-clinical-green)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                          <YAxis hide domain={['dataMin - 5', 'dataMax + 5']} />
                          <Tooltip content={({ payload }) => <div className="text-xs text-clinical-slate bg-clinical-surface border border-clinical-line rounded px-2 py-1 shadow-sm">{payload?.[0]?.value ? `${Math.round(Number(payload[0].value))} BPM` : ''}</div>} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  {/* Fluid Balance */}
                  <div className="panel">
                    <div className="panel-header">
                      <span className="panel-title">Fluid Balance</span>
                      <span className="text-xs font-mono text-clinical-blue">+{(medicalCase?.medications.length || 0) * 200} mL</span>
                    </div>
                    <div className="panel-body">
                      <div className="flex justify-between items-end gap-3 h-20">
                        <div className="flex-1 bg-clinical-bg border border-clinical-line rounded-t relative overflow-hidden h-full"><div className="absolute bottom-0 left-0 right-0 bg-clinical-blue/10 transition-all duration-1000" style={{ height: `${Math.min(100, (medicalCase?.medications.length || 0) * 10 + 20)}%` }} /><div className="absolute inset-0 flex items-center justify-center text-[9px] font-medium text-clinical-slate z-10">Intake</div></div>
                        <div className="flex-1 bg-clinical-bg border border-clinical-line rounded-t relative overflow-hidden h-full"><div className="absolute bottom-0 left-0 right-0 bg-clinical-amber/10 transition-all duration-1000" style={{ height: '35%' }} /><div className="absolute inset-0 flex items-center justify-center text-[9px] font-medium text-clinical-slate z-10">Output</div></div>
                      </div>
                    </div>
                  </div>
                  {/* Intervention Timeline */}
                  <div className="panel flex flex-col min-h-[250px] max-h-[350px]">
                    <div className="panel-header"><span className="panel-title">Timeline</span></div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {(medicalCase?.clinicalActions || []).length === 0 ? (
                        <EmptyState icon={<History className="w-10 h-10" />} title="Timeline empty" description="Actions will appear here as you intervene." />
                      ) : (
                        (medicalCase?.clinicalActions || []).map((a, i) => (
                          <div key={i} className="flex gap-3">
                            <div className="text-[10px] font-mono text-clinical-slate w-10 pt-0.5 shrink-0">T+{a.timestamp}</div>
                            <div className="flex-1 border-l border-clinical-line/50 pl-3 pb-2"><p className="text-xs font-medium text-clinical-ink mb-0.5">{a.description}</p>{(a.impact || a.result) && <p className="text-[10px] text-clinical-slate">{a.impact || a.result}</p>}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}




            {/* Assessment Tab */}
            {activeTab === 'assess' && (
              <motion.div key="assess" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
                <div className="panel">
                  <div className="panel-header">
                    <span className="panel-title flex items-center gap-2"><Stethoscope className="w-3.5 h-3.5" /> Assessment & Plan</span>
                    {feedback && <span className="text-[10px] font-medium text-clinical-blue bg-clinical-blue/10 px-2 py-0.5 rounded-full">CASE CLOSED</span>}
                  </div>
                  <div className="p-5">
                    {!feedback ? (
                      <div className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div>
                            <label className="text-[10px] font-medium text-clinical-slate uppercase mb-2 block">Working Differential</label>
                            <textarea placeholder={"1. Septic Shock\n2. PE\n3. Hypovolemic Shock"} className="w-full h-20 bg-clinical-bg border border-clinical-line rounded-md p-3 text-xs font-mono focus:outline-none focus:border-clinical-blue/50 focus:ring-1 focus:ring-clinical-blue/30 resize-none" />
                          </div>
                          <div>
                            <label className="text-[10px] font-medium text-clinical-slate uppercase mb-2 block">Confirmatory Findings</label>
                            <div className="flex flex-wrap gap-1.5">
                              {medicalCase?.labs.filter(l => l.status === 'critical').map(l => (
                                <span key={l.name} className="px-2 py-1 bg-clinical-red/8 text-clinical-red text-[10px] font-medium rounded-full flex items-center gap-1"><AlertTriangle className="w-2.5 h-2.5" /> {l.name}: {l.value}</span>
                              ))}
                              {medicalCase?.imaging.filter(i => i.availableAt && i.availableAt <= simTime).map(i => (
                                <span key={i.type} className="px-2 py-1 bg-clinical-blue/8 text-clinical-blue text-[10px] font-medium rounded-full">{i.type}</span>
                              ))}
                              {(medicalCase?.labs.filter(l => l.status === 'critical').length === 0 && medicalCase?.imaging.filter(i => i.availableAt && i.availableAt <= simTime).length === 0) && (
                                <span className="text-xs text-clinical-slate/50 italic">No critical findings yet</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-clinical-line/50">
                          <textarea value={userDiagnosis} onChange={(e) => setUserDiagnosis(e.target.value)} placeholder="Enter final working diagnosis and disposition plan..." className="flex-1 h-16 bg-clinical-bg border border-clinical-line rounded-md p-3 text-sm focus:outline-none focus:ring-1 focus:ring-clinical-blue/30 transition-all resize-none" />
                          <button onClick={handleSubmitDiagnosis} disabled={submitting || !userDiagnosis} className="sm:h-16 px-6 py-3 bg-clinical-blue hover:bg-clinical-blue/90 text-white rounded-md flex items-center justify-center gap-2 transition-all disabled:opacity-50 shrink-0">
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            <span className="text-xs font-medium">Submit</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-5 animate-in fade-in">
                        <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start">
                          <div className="w-16 h-16 rounded-full border-2 border-clinical-line flex items-center justify-center relative shrink-0">
                            <svg className="absolute inset-0 w-full h-full -rotate-90"><circle cx="32" cy="32" r="28" fill="none" stroke="#E8ECF1" strokeWidth="3" /><circle cx="32" cy="32" r="28" fill="none" stroke="var(--color-clinical-blue)" strokeWidth="3" strokeDasharray={`${feedback.score * 1.76} 176`} /></svg>
                            <span className="text-lg font-semibold text-clinical-ink">{feedback.score}</span>
                          </div>
                          <div className="flex-1 text-center sm:text-left">
                            <h4 className="text-xs font-semibold text-clinical-blue uppercase tracking-wide mb-2">{feedback.score >= 80 ? 'Success' : 'Review Required'}</h4>
                            <div className="bg-clinical-bg p-4 rounded-lg border border-clinical-line text-sm text-clinical-ink leading-relaxed italic">"{feedback.feedback}"</div>
                            <p className="text-xs text-clinical-slate mt-3">Correct Diagnosis: <span className="font-medium text-clinical-ink">{medicalCase?.correctDiagnosis}</span></p>
                          </div>
                        </div>
                        {(medicalCase?.clinicalActions || []).length > 0 && (
                          <div className="border-t border-clinical-line/50 pt-4">
                            <h5 className="text-[10px] font-medium text-clinical-slate uppercase mb-3">Action Audit</h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                              {medicalCase?.clinicalActions.map((action, i) => (
                                <div key={i} className="flex gap-2 text-xs bg-clinical-bg/50 p-2 rounded-md border border-clinical-line/50"><span className="font-mono text-clinical-blue shrink-0">T+{action.timestamp}</span><span className="text-clinical-ink truncate">{action.description}</span></div>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="flex justify-center items-center gap-3 pt-3">
                          <button onClick={() => loadNewCase()} className="px-8 py-2.5 bg-clinical-blue text-white rounded-lg font-medium text-sm hover:bg-clinical-blue/90 transition-all">Next Patient</button>
                          <CaseExport medicalCase={medicalCase} feedback={feedback} logs={logs} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
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

            {activeTab === 'notes' && (<motion.div key="notes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 min-h-0"><ClinicalNotes /></motion.div>)}
            {activeTab === 'tools' && (<motion.div key="tools" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 min-h-0"><ClinicalGuidelines /></motion.div>)}
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <div className="mobile-bottom-nav lg:hidden">
        {mobileNavTabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={cn("mobile-bottom-nav-item", activeTab === tab.id && "active")}>
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Undo Bar */}
      <AnimatePresence>
        {canUndo && (
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-20 lg:bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-clinical-ink text-white px-4 py-2.5 rounded-lg shadow-xl border border-white/10"
          >
            <Undo2 className="w-3.5 h-3.5 text-clinical-amber" />
            <span className="text-xs font-medium">{lastAction}</span>
            <button
              onClick={handleUndo}
              className="ml-2 px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-xs font-medium transition-colors"
            >
              Undo
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Consultant Slide-over */}
      <AnimatePresence>
        {isConsultOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsConsultOpen(false)} className="fixed inset-0 bg-clinical-ink/30 backdrop-blur-sm z-[100]" aria-hidden="true" />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} role="dialog" aria-modal="true" aria-label="AI Consultant" className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white border-l border-clinical-line z-[101] shadow-xl flex flex-col">
              <div className="h-14 bg-clinical-ink text-white px-5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <Brain className="w-5 h-5 text-clinical-amber" />
                  <div><h3 className="text-sm font-semibold">AI Consultant</h3><p className="text-[10px] text-white/50">Specialist reasoning</p></div>
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
                    <section><label className="text-[10px] font-medium text-clinical-blue uppercase tracking-wide flex items-center gap-1.5 mb-2"><Sparkles className="w-3 h-3" /> Expert Impression</label><div className="p-4 bg-clinical-bg border-l-3 border-clinical-blue rounded-r-lg text-sm leading-relaxed text-clinical-ink italic">"{consultantAdvice.advice}"</div></section>
                    <section><label className="text-[10px] font-medium text-clinical-slate uppercase tracking-wide mb-2 block">Reasoning</label><p className="text-sm text-clinical-ink leading-relaxed">{consultantAdvice.reasoning}</p></section>
                    <section><label className="text-[10px] font-medium text-clinical-amber uppercase tracking-wide flex items-center gap-1.5 mb-2"><Zap className="w-3 h-3" /> Recommended Actions</label><div className="space-y-2">{consultantAdvice.recommendedActions.map((action, i) => (<div key={i} className="flex items-start gap-3 p-3 bg-clinical-amber/5 border border-clinical-amber/10 rounded-lg"><div className="w-5 h-5 rounded-full bg-clinical-amber text-white flex items-center justify-center text-[10px] font-medium shrink-0">{i + 1}</div><p className="text-xs text-clinical-ink mt-0.5">{action}</p></div>))}</div></section>
                    <div className="p-4 bg-clinical-blue/5 border border-clinical-blue/10 rounded-lg"><p className="text-[10px] text-clinical-blue leading-relaxed"><strong className="block mb-0.5">Disclaimer:</strong>AI-generated for educational purposes. Always correlate with bedside presentation.</p></div>
                  </>
                ) : (
                  <EmptyState icon={<AlertCircle className="w-10 h-10" />} title="No advice generated" description="Request a consultation to get expert guidance." />
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
