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
  Stethoscope as StethIcon,
  Plus,
  FileSearch,
  ChevronRight,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  User as UserIcon,
  History,
  Send,
  Loader2,
  Phone,
  MessageSquare,
  UserPlus,
  RefreshCw,
  Clock,
  ShieldAlert,
  Menu,
  X,
  Sparkles,
  Brain,
  PenTool,
  Zap,
  BookOpen,
  Pill
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
import { cn } from './lib/utils';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("UI Crash:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-clinical-bg flex items-center justify-center p-8">
          <div className="bg-clinical-surface border border-clinical-line p-8 rounded-lg max-w-md text-center shadow-xl">
            <AlertCircle className="w-12 h-12 text-clinical-red mx-auto mb-4" aria-hidden="true" />
            <h2 className="text-xl font-bold text-clinical-ink mb-2">Interface Disruption</h2>
            <p className="text-sm text-clinical-slate mb-6">The clinical dashboard encountered a processing error. Patient data state remains intact.</p>
            <button onClick={() => window.location.reload()} className="w-full py-3 bg-clinical-blue text-white rounded font-bold uppercase text-xs tracking-widest">
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
  return (
    <ErrorBoundary>
      <ClinicalSimulator />
    </ErrorBoundary>
  );
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
  const [medicalCase, setMedicalCase] = useState<MedicalCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'hpi' | 'exam' | 'labs' | 'imaging' | 'pharmacy' | 'treatment' | 'comms' | 'archive' | 'notes' | 'tools'>('hpi');
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
  // Fix: Replace document.getElementById with React state for custom med input
  const [customMedInput, setCustomMedInput] = useState('');

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
    setIntervening(true);
    const interventionToExecute = directIntervention || interventionInput || "Observation";
    const actionText = directIntervention ? `ACTION: ${directIntervention}` : (customWait ? `WAIT ${customWait} min` : `ORDER: ${interventionInput}`);
    setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), text: actionText }]);
    try {
      const updatedCase = await performIntervention(interventionToExecute, medicalCase, customWait || 5);
      setMedicalCase(prev => {
        if (!prev) return updatedCase;
        return { ...prev, ...updatedCase, labs: updatedCase.labs || prev.labs, imaging: updatedCase.imaging || prev.imaging, clinicalActions: updatedCase.clinicalActions || prev.clinicalActions, vitals: { ...prev.vitals, ...(updatedCase.vitals || {}) } };
      });
      setInterventionInput('');
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
    } catch (error) { console.error("Failed to evaluate diagnosis:", error); }
    finally { setSubmitting(false); }
  };

  const handleStaffCall = async () => {
    if (!medicalCase || !callMessage) return;
    setCalling(true);
    try {
      const { reply, updatedCase } = await staffCall(callTarget, callMessage, medicalCase);
      setMedicalCase(updatedCase);
      setCallMessage('');
      setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), text: `COMM: Call to ${callTarget} - "${reply.slice(0, 30)}..."` }]);
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
    } catch (err) { console.error(err); }
    finally { setIntervening(false); }
  };

  if (loading || error) {
    return (
      <div className="min-h-screen bg-clinical-bg flex items-center justify-center font-sans">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-6 max-w-md text-center">
          {error ? (
            <div className="p-8 bg-clinical-surface border border-clinical-line rounded-lg shadow-sm">
              <AlertCircle className="w-10 h-10 text-clinical-red mx-auto mb-4" aria-hidden="true" />
              <h2 className="text-lg font-bold mb-2 text-clinical-ink">System Fault</h2>
              <p className="text-sm text-clinical-slate mb-6 leading-relaxed">{error}</p>
              <button onClick={() => loadNewCase()} className="w-full py-2 bg-clinical-blue text-white rounded font-medium text-sm flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4" /> Restart Station
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center" role="status" aria-label="Loading">
              <Loader2 className="w-8 h-8 animate-spin text-clinical-blue mb-4" />
              <p className="text-xs uppercase tracking-widest font-bold text-clinical-slate">Synchronizing Clinic Data...</p>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  const simTime = medicalCase?.simulationTime || 0;

  // Navigation tabs config (used in both mobile drawer and desktop sidebar)
  const navTabs = [
    { id: 'hpi', icon: <Clipboard className="w-4 h-4" />, label: 'History & Intake' },
    { id: 'exam', icon: <Stethoscope className="w-4 h-4" />, label: 'Physical Exam' },
    { id: 'labs', icon: <FlaskConical className="w-4 h-4" />, label: 'Order Results' },
    { id: 'imaging', icon: <FileSearch className="w-4 h-4" />, label: 'Radiology PACS' },
    { id: 'pharmacy', icon: <Pill className="w-4 h-4" />, label: 'Pharmacy' },
    { id: 'comms', icon: <Phone className="w-4 h-4" />, label: 'Communication' },
    { id: 'treatment', icon: <Activity className="w-4 h-4" />, label: 'Interventions' },
    { id: 'notes', icon: <PenTool className="w-4 h-4" />, label: 'Clinical Notes' },
    { id: 'tools', icon: <BookOpen className="w-4 h-4" />, label: 'Guidelines' },
    ...(user ? [{ id: 'archive', icon: <History className="w-4 h-4" />, label: 'Clinical Archive' }] : [])
  ];

  return (
    <div className="min-h-screen h-screen bg-clinical-bg flex flex-col overflow-hidden text-clinical-ink">
      {!isSupabaseConfigured && (
        <div className="bg-clinical-amber/10 border-b border-clinical-amber/30 py-2 px-4 md:px-6 flex items-center justify-between z-50" role="alert">
          <div className="flex items-center gap-2 text-clinical-amber">
            <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Persistence Offline: Supabase keys missing</span>
          </div>
          <p className="text-[9px] text-clinical-amber opacity-80 italic hidden sm:block">Simulation results will not be saved.</p>
        </div>
      )}

      <CaseLibrary isOpen={isLibraryOpen} onClose={() => setIsLibraryOpen(false)} onSelectCase={(diff, cat, env) => loadNewCase(diff, cat, env)} />
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />


      {/* EHR Header - Fixed: removed duplicate Active Orders widget */}
      <header className="h-14 bg-clinical-surface border-b border-clinical-line flex items-center px-4 md:px-6 shrink-0 shadow-sm z-30" role="banner">
        <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
           <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 hover:bg-clinical-bg rounded" aria-label="Open navigation menu">
             <Menu className="w-5 h-5 text-clinical-slate" />
           </button>
           <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-clinical-blue rounded-sm flex items-center justify-center shrink-0" aria-hidden="true">
                <Activity className="text-white w-3 h-3" />
              </div>
              <span className="text-sm font-bold tracking-tight hidden sm:inline">OpenEHR v4.2</span>
           </div>
           <div className="h-6 w-px bg-clinical-line hidden sm:block" />

           {/* Single Active Orders widget (removed duplicate) */}
           <div className="hidden xl:flex items-center gap-4 bg-clinical-bg border border-clinical-line rounded-lg px-3 py-1.5 h-10 overflow-hidden">
              <div className="flex items-center gap-2 opacity-40 shrink-0">
                <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                <span className="text-[9px] font-black uppercase tracking-widest">Active Orders</span>
              </div>
              <div className="flex gap-2 min-w-0">
                {medicalCase?.labs.filter(l => !l.availableAt).map(l => (
                   <div key={l.name} className="flex flex-col text-[8px] font-bold bg-white px-2 py-0.5 rounded border border-clinical-line shrink-0">
                      <span className="text-clinical-ink uppercase truncate max-w-[60px]">{l.name}</span>
                      <span className="text-clinical-blue">PENDING</span>
                   </div>
                ))}
                {medicalCase?.imaging.filter(i => !i.availableAt).map(i => (
                   <div key={i.type} className="flex flex-col text-[8px] font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200 shrink-0">
                      <span className="text-amber-800 uppercase truncate max-w-[60px]">{i.type}</span>
                      <span className="text-amber-600 italic">PROCESSING</span>
                   </div>
                ))}
                {(!medicalCase?.labs.some(l => !l.availableAt) && !medicalCase?.imaging.some(i => !i.availableAt)) && (
                   <span className="text-[9px] font-bold text-clinical-slate opacity-20 uppercase tracking-tighter">Queue Empty</span>
                )}
              </div>
           </div>

           <div className="text-[11px] font-bold text-clinical-slate uppercase flex items-center gap-2 md:gap-3 flex-1 min-w-0">
              <span className="flex items-center gap-1 min-w-0">
                <UserIcon className="w-3 h-3 shrink-0" aria-hidden="true" />
                <span className="text-clinical-ink truncate max-w-[80px] md:max-w-none">{medicalCase?.patientName}</span>
              </span>
              <div className="h-3 w-px bg-clinical-line hidden md:block" />
              <span className="hidden md:inline">ID: <span className="text-clinical-ink">#882-019-X</span></span>
              <div className="h-3 w-px bg-clinical-line hidden lg:block" />
              <div className="flex items-center gap-4">
                <button onClick={() => setIsLibraryOpen(true)} className="flex items-center gap-1.5 text-clinical-blue hover:bg-clinical-blue/10 px-2 py-1 rounded transition-colors" aria-label="Open case library">
                  <Clipboard className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">Case Library</span>
                </button>
                <span className="hidden lg:flex items-center gap-1.5 text-clinical-blue">
                  <div className="w-1.5 h-1.5 rounded-full bg-clinical-amber animate-pulse" aria-hidden="true" />
                  {medicalCase?.currentLocation || 'ER Bay 4'}
                </span>
              </div>
           </div>
        </div>

        <div className="ml-auto flex items-center gap-2 md:gap-4">
          {user ? (
            <div className="flex items-center gap-3 bg-clinical-bg border border-clinical-line rounded-lg px-2 py-1 h-10">
              <div className="text-right flex-col justify-center hidden sm:flex">
                <div className="text-[10px] font-black text-clinical-ink truncate max-w-[80px] leading-none uppercase tracking-tighter">{user.email?.split('@')[0]}</div>
                <button onClick={handleLogout} className="text-[7px] font-black text-clinical-slate uppercase tracking-widest hover:text-clinical-red block mt-1" aria-label="Log out">Log Off</button>
              </div>
              <div className="w-7 h-7 bg-clinical-blue rounded-full flex items-center justify-center text-[10px] font-black text-white uppercase shadow-lg shadow-clinical-blue/20" aria-hidden="true">
                {user.email?.[0]}
              </div>
            </div>
          ) : (
            <button onClick={() => setIsAuthOpen(true)} className="flex items-center gap-2 h-10 px-3 md:px-4 bg-clinical-ink text-white rounded font-black uppercase text-[10px] tracking-widest hover:bg-clinical-blue transition-all" aria-label="Sign in">
              <UserIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign In</span>
            </button>
          )}
          <div className="h-8 w-px bg-clinical-line hidden sm:block" />
          <div className="flex flex-col items-end shrink-0">
              <span className="text-[9px] md:text-[10px] font-bold text-clinical-slate uppercase tracking-widest">T + {simTime} min</span>
              <span className="text-xs md:text-sm font-mono font-bold text-clinical-blue hidden md:inline">Elapsed Time</span>
          </div>
          <button onClick={() => loadNewCase()} className="p-2 hover:bg-clinical-bg rounded text-clinical-slate transition-colors" aria-label="Reset and load new case">
              <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Alarm Banner */}
      <AnimatePresence>
        {(medicalCase?.activeAlarms || []).length > 0 && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-clinical-red text-white py-2 px-4 md:px-6 flex items-center justify-between border-b border-red-900 overflow-hidden shrink-0" role="alert">
            <div className="flex items-center gap-4">
              <AlertCircle className="w-5 h-5 animate-pulse" aria-hidden="true" />
              <div className="flex gap-2 md:gap-4 flex-wrap">
                {medicalCase?.activeAlarms.map((alarm, i) => (
                  <span key={i} className="text-[11px] font-bold uppercase tracking-widest bg-white/20 px-3 py-0.5 rounded flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" aria-hidden="true" />
                    {alarm}
                  </span>
                ))}
              </div>
            </div>
            <span className="text-[10px] font-mono opacity-60 hidden md:block">SYSTEM ALERT: CRITICAL PHYSIOLOGY DETECTED</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Vitals Rail - improved mobile: scrollable, flexible sizing */}
      <div className="h-14 md:h-16 bg-white border-b border-clinical-line flex items-center px-2 gap-1 md:gap-2 shrink-0 overflow-x-auto no-scrollbar" role="region" aria-label="Patient vital signs">
          <div className="flex items-center gap-1 px-2 md:px-4 border-r border-clinical-line h-full mr-2 md:mr-4 shrink-0">
             <div className={cn("w-3 h-3 rounded-full animate-pulse", medicalCase?.physiologicalTrend === 'improving' ? "bg-clinical-green" : medicalCase?.physiologicalTrend === 'declining' ? "bg-clinical-amber" : medicalCase?.physiologicalTrend === 'critical' ? "bg-clinical-red" : "bg-clinical-slate")} aria-hidden="true" />
             <div className="flex flex-col">
               <span className="text-[10px] font-bold text-clinical-slate uppercase tracking-widest ml-1">{medicalCase?.physiologicalTrend}</span>
               <span className="text-[7px] text-clinical-slate opacity-40 uppercase tracking-tighter ml-1">Trend</span>
             </div>
          </div>
          <div className="flex-1 max-w-sm h-12 mr-4 shrink-0 hidden lg:block">
            <ECGMonitor heartRate={medicalCase?.vitals?.heartRate || 0} isAlarming={medicalCase?.activeAlarms.some(a => a.includes('HR') || a.includes('Pulse') || a.includes('Bradycardia') || a.includes('Tachycardia'))} />
          </div>
          <ClinicalVital label="HR" value={Math.round(vitalsHistory[vitalsHistory.length - 1]?.hr || medicalCase?.vitals?.heartRate || 0)} unit="BPM" status="normal" isAlarming={medicalCase?.activeAlarms.some(a => a.includes('HR') || a.includes('Pulse') || a.includes('Bradycardia') || a.includes('Tachycardia'))} trend={vitalsHistory.map(v => v.hr)} />
          <ClinicalVital label="BP" value={medicalCase?.vitals?.bloodPressure || '--'} unit="mmHg" status="normal" isAlarming={medicalCase?.activeAlarms.some(a => a.includes('BP') || a.includes('Pressure') || a.includes('Hypotension') || a.includes('Hypertension'))} trend={vitalsHistory.map(v => v.sbp)} />
          <ClinicalVital label="RR" value={medicalCase?.vitals?.respiratoryRate || '--'} unit="/min" status="normal" isAlarming={medicalCase?.activeAlarms.some(a => a.includes('RR') || a.includes('Respiratory') || a.includes('Tachypnea') || a.includes('Apnea'))} trend={vitalsHistory.map(v => v.rr)} />
          <ClinicalVital label="SpO2" value={medicalCase?.vitals?.oxygenSaturation || 0} unit="%" status="normal" isAlarming={medicalCase?.activeAlarms.some(a => a.includes('SpO2') || a.includes('Saturation') || a.includes('Hypoxia'))} trend={vitalsHistory.map(v => v.spo2)} />
          <ClinicalVital label="T" value={medicalCase?.vitals?.temperature || 0} unit="°C" status="normal" isAlarming={medicalCase?.activeAlarms.some(a => a.includes('Temp') || a.includes('Temperature') || a.includes('Fever'))} />
          <div className="h-full w-px bg-clinical-line" />
          <div className="flex flex-col px-2 md:px-4 items-center justify-center bg-clinical-bg/50 rounded shrink-0">
             <div className="text-[9px] font-bold text-clinical-slate uppercase mb-0.5">NEWS2</div>
             <div className={cn("text-xl font-mono font-black", calculateNEWS2(medicalCase?.vitals) >= 7 ? "text-clinical-red animate-pulse" : calculateNEWS2(medicalCase?.vitals) >= 5 ? "text-clinical-amber" : "text-clinical-ink")} aria-label={`NEWS2 score: ${calculateNEWS2(medicalCase?.vitals)}`}>
               {calculateNEWS2(medicalCase?.vitals)}
             </div>
          </div>
      </div>


      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile Navigation Drawer */}
        <AnimatePresence>
          {isSidebarOpen && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-clinical-ink/60 backdrop-blur-sm z-[100] lg:hidden" aria-hidden="true" />
              <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed top-0 left-0 bottom-0 w-64 bg-clinical-surface border-r border-clinical-line z-[101] lg:hidden flex flex-col p-4" role="dialog" aria-modal="true" aria-label="Navigation menu">
                <div className="flex items-center justify-between mb-8 px-2">
                   <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-clinical-blue rounded-sm flex items-center justify-center" aria-hidden="true"><Activity className="text-white w-3 h-3" /></div>
                      <span className="text-sm font-bold tracking-tight">OpenEHR Mobile</span>
                   </div>
                   <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-clinical-bg rounded" aria-label="Close navigation">
                      <X className="w-5 h-5 text-clinical-slate" />
                   </button>
                </div>
                <nav className="space-y-1" aria-label="Main navigation">
                   {navTabs.map(tab => (
                     <NavTab key={tab.id} active={activeTab === tab.id} icon={tab.icon} label={tab.label} onClick={() => { setActiveTab(tab.id as any); setIsSidebarOpen(false); }} />
                   ))}
                </nav>
                <div className="mt-auto pt-6 border-t border-clinical-line">
                   <h3 className="text-[10px] font-bold text-clinical-slate uppercase tracking-widest mb-3 px-2">Care Summary</h3>
                   <div className="p-4 bg-yellow-50/50 border border-yellow-200/50 rounded-lg">
                      <p className="text-[10px] text-yellow-800 leading-relaxed italic">"{medicalCase?.currentCondition}"</p>
                   </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Navigation Sidebar (Desktop) - Fixed: pharmacy tab added */}
        <nav className="w-60 bg-clinical-surface border-r border-clinical-line flex-col p-4 z-20 shrink-0 hidden lg:flex" aria-label="Main navigation">
           <div className="space-y-1">
              {navTabs.map(tab => (
                <NavTab key={tab.id} active={activeTab === tab.id} icon={tab.icon} label={tab.label} onClick={() => setActiveTab(tab.id as any)} />
              ))}
           </div>
           <div className="mt-8 space-y-4">
              <button onClick={handleConsult} disabled={isConsulting || !medicalCase} className="w-full h-12 bg-clinical-ink border border-clinical-line rounded-lg flex items-center gap-3 px-4 text-white hover:bg-clinical-blue transition-all group overflow-hidden relative disabled:opacity-50" aria-label="Request AI consultant advice">
                <div className="absolute inset-0 bg-white/5 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                {isConsulting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-clinical-amber" />}
                <div className="flex flex-col items-start min-w-0">
                  <span className="text-[10px] font-black uppercase tracking-widest leading-none">AI Consultant</span>
                  <span className="text-[8px] opacity-60 uppercase truncate">Request Specialty Advice</span>
                </div>
                <Zap className="w-3 h-3 ml-auto opacity-30 group-hover:opacity-100 transition-opacity" />
              </button>
           </div>
           <div className="mt-auto pt-6 border-t border-clinical-line">
              <h3 className="text-[10px] font-bold text-clinical-slate uppercase tracking-widest mb-3 px-2">Care Summary</h3>
              <div className="p-4 bg-yellow-50/50 border border-yellow-200/50 rounded-lg">
                 <p className="text-[11px] text-yellow-800 leading-relaxed italic">"{medicalCase?.currentCondition}"</p>
              </div>
           </div>
        </nav>

        {/* Clinical Workspace */}
        <main className="flex-1 overflow-y-auto bg-clinical-bg p-3 md:p-6 flex flex-col gap-6" role="main">
          <AnimatePresence mode="wait">
            {activeTab === 'hpi' && (
              <motion.div key="hpi" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-clinical-surface border border-clinical-line rounded shadow-sm overflow-hidden">
                <div className="bg-clinical-bg p-3 border-b border-clinical-line text-[11px] font-bold text-clinical-slate uppercase">Documentation: Intake Nurse Statement</div>
                <div className="p-4 md:p-8 space-y-8 md:space-y-10">
                  <section>
                    <label className="text-[10px] font-bold text-clinical-slate uppercase block mb-2">Chief Complaint</label>
                    <p className="text-xl md:text-2xl font-serif text-clinical-ink leading-tight underline decoration-clinical-blue/20">"{medicalCase?.chiefComplaint}"</p>
                  </section>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-16">
                    <section>
                       <label className="text-[10px] font-bold text-clinical-slate uppercase block mb-3 border-b border-clinical-line pb-1">Clinical History (HPI)</label>
                       <p className="text-[13px] text-clinical-ink leading-relaxed font-medium whitespace-pre-wrap">{medicalCase?.historyOfPresentIllness}</p>
                    </section>
                    <section>
                       <label className="text-[10px] font-bold text-clinical-slate uppercase block mb-3 border-b border-clinical-line pb-1">Past Medical History</label>
                       <div className="space-y-2">
                          {(medicalCase?.pastMedicalHistory || []).map((m, i) => (
                            <div key={i} className="flex items-center gap-3 text-sm"><div className="w-1.5 h-1.5 border border-clinical-slate rotate-45" aria-hidden="true" />{m}</div>
                          ))}
                       </div>
                    </section>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'exam' && (
              <motion.div key="exam" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6">
                <div className="bg-clinical-surface border border-clinical-line rounded shadow-sm overflow-hidden">
                  <div className="bg-clinical-ink p-3 border-b border-clinical-line flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                     <span className="text-[10px] font-bold text-white uppercase tracking-widest">Glasgow Coma Scale (GCS) Workspace</span>
                     <div className="flex items-center gap-2">
                        <span className="text-[9px] text-white/50 uppercase">Computed Score:</span>
                        <span className="text-xl font-mono font-black text-clinical-green">E{gcsState.eyes} V{gcsState.verbal} M{gcsState.motor} = {gcsState.eyes + gcsState.verbal + gcsState.motor}</span>
                     </div>
                  </div>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                     {(['eyes', 'verbal', 'motor'] as const).map(category => (
                       <div key={category} className="space-y-3" role="radiogroup" aria-label={`${category} response`}>
                         <label className="text-[9px] font-bold text-clinical-slate uppercase opacity-60 tracking-widest border-b border-clinical-line w-full block pb-1">{category} Response</label>
                         <div className="flex flex-col gap-1.5">
                           {GCS_MAPPING[category].map(option => (
                             <button key={option.score} onClick={() => setGcsState(prev => ({ ...prev, [category]: option.score }))} role="radio" aria-checked={gcsState[category] === option.score} className={cn("text-left p-3 rounded text-[10px] transition-all border group", gcsState[category] === option.score ? "bg-clinical-blue text-white border-clinical-blue font-bold shadow-md transform scale-[1.02]" : "bg-white border-clinical-line hover:border-clinical-blue/40 text-clinical-ink")}>
                               <div className="flex justify-between items-center mb-1">
                                 <span className="uppercase tracking-tight">{option.label}</span>
                                 <span className={cn("text-[9px] font-mono", gcsState[category] === option.score ? "text-white/60" : "text-clinical-slate")}>{option.score}</span>
                               </div>
                               <p className={cn("text-[8px] font-normal leading-tight opacity-70", gcsState[category] === option.score ? "text-white/80" : "text-clinical-slate")}>{option.desc}</p>
                             </button>
                           ))}
                         </div>
                       </div>
                     ))}
                  </div>
                  <div className="bg-clinical-bg p-3 border-t border-clinical-line flex items-center gap-2">
                     <div className="w-2 h-2 rounded-full bg-clinical-blue animate-pulse" aria-hidden="true" />
                     <span className="text-[9px] text-clinical-slate uppercase font-bold tracking-tight">Clinical Correlation Essential. "The score is a sign, not a diagnosis."</span>
                  </div>
                </div>
                <div className="bg-clinical-surface border border-clinical-line rounded shadow-sm overflow-hidden">
                  <div className="bg-clinical-bg p-3 border-b border-clinical-line text-[11px] font-bold text-clinical-slate uppercase tracking-wider">Physical Examination Findings</div>
                  <div className="p-4 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 md:gap-y-8">
                    {Object.entries(medicalCase?.physicalExam || {}).map(([key, val]) => (
                      <div key={key} className="space-y-1">
                        <h4 className="text-[10px] font-bold text-clinical-slate uppercase">{key}</h4>
                        <div className="p-3 bg-clinical-bg/30 border-l-2 border-clinical-line text-sm text-clinical-ink italic">{val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}


            {activeTab === 'labs' && (
              <motion.div key="labs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6 flex-1 min-h-0">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
                  <div className="lg:col-span-2 bg-clinical-surface border border-clinical-line rounded shadow-sm overflow-hidden flex flex-col min-h-[300px]">
                    <div className="bg-clinical-bg p-3 border-b border-clinical-line flex justify-between items-center">
                      <span className="text-[11px] font-bold text-clinical-slate uppercase">Clinical Chemistry & Hematology</span>
                      <span className="text-[9px] text-clinical-slate italic hidden sm:inline">Specimen: Whole Blood / Plasma</span>
                    </div>
                    <div className="flex-1 overflow-auto">
                      <table className="clinical-table w-full" aria-label="Lab results">
                        <thead className="sticky top-0 bg-white z-10">
                          <tr><th scope="col">Test</th><th scope="col">Value</th><th scope="col">Status</th><th scope="col">Reference</th><th className="w-10"></th></tr>
                        </thead>
                        <tbody>
                          {(medicalCase?.labs || []).map((lab) => {
                            const isAvailable = lab.orderedAt !== undefined && lab.availableAt !== undefined && lab.availableAt <= simTime;
                            const isPending = lab.orderedAt !== undefined && (lab.availableAt === undefined || lab.availableAt > simTime);
                            return (
                              <tr key={lab.name} onClick={() => isAvailable && setSelectedLab(lab)} className={cn("transition-colors cursor-pointer", selectedLab?.name === lab.name ? "bg-clinical-blue/5" : "hover:bg-clinical-bg/30")}>
                                <td className="font-bold text-clinical-ink">{lab.name}</td>
                                <td className="font-mono text-sm px-4">{isAvailable ? (<span className={cn(lab.status === 'critical' ? 'text-clinical-red font-black' : lab.status === 'abnormal' ? 'text-clinical-amber' : '')}>{lab.value}</span>) : <span className="opacity-20">---</span>}</td>
                                <td>{!lab.orderedAt ? (<button onClick={(e) => { e.stopPropagation(); handleOrderDiagnostic('lab', lab.name); }} className="text-[10px] font-bold text-clinical-blue uppercase hover:underline" aria-label={`Order ${lab.name}`}>[Order Stat]</button>) : isPending ? (<span className="text-[10px] font-bold text-clinical-amber uppercase animate-pulse">Pending...</span>) : (<div className="flex items-center gap-1.5"><div className={cn("w-1.5 h-1.5 rounded-full", lab.status === 'critical' ? 'bg-clinical-red' : lab.status === 'abnormal' ? 'bg-clinical-amber' : 'bg-clinical-green')} /><span className="text-[10px] uppercase font-bold tracking-tighter opacity-60">{lab.status}</span></div>)}</td>
                                <td className="text-[11px] text-clinical-slate">{lab.normalRange} {lab.unit}</td>
                                <td>{isAvailable && <ChevronRight className="w-3 h-3 opacity-30" />}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="lg:col-span-1 bg-clinical-surface border border-clinical-line rounded shadow-sm flex flex-col overflow-hidden min-h-[250px]">
                    <div className="bg-clinical-bg p-3 border-b border-clinical-line"><span className="text-[10px] font-bold text-clinical-slate uppercase tracking-widest">Result Interpretations</span></div>
                    <div className="flex-1 p-4 md:p-6 overflow-y-auto">
                      {selectedLab ? (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                           <div><h4 className="text-[10px] font-bold text-clinical-slate uppercase tracking-widest mb-1">Component</h4><p className="text-lg font-bold">{selectedLab.name}</p></div>
                           <div className="grid grid-cols-2 gap-4">
                             <div className="bg-clinical-bg p-3 rounded"><h5 className="text-[9px] font-bold text-clinical-slate uppercase mb-1">Current</h5><p className="font-mono text-xl font-bold">{selectedLab.value}</p></div>
                             <div className="bg-clinical-bg p-3 rounded"><h5 className="text-[9px] font-bold text-clinical-slate uppercase mb-1">Status</h5><p className={cn("text-[11px] font-bold uppercase", selectedLab.status === 'critical' ? "text-clinical-red" : selectedLab.status === 'abnormal' ? "text-clinical-amber" : "text-clinical-green")}>{selectedLab.status}</p></div>
                           </div>
                           <div><h4 className="text-[10px] font-bold text-clinical-slate uppercase tracking-widest mb-3 border-b border-clinical-line pb-1">Pathologist / Tech Comments</h4><p className="text-xs text-clinical-ink italic leading-relaxed border-l-2 border-clinical-blue/20 pl-4">{selectedLab.clinicalNote || "No morphological abnormalities noted. Validated by automated analyzer."}</p></div>
                           <div className="pt-4 space-y-2">
                             <div className="flex justify-between text-[10px]"><span className="text-clinical-slate uppercase font-bold">Ordered:</span><span className="font-mono">T + {selectedLab.orderedAt}m</span></div>
                             <div className="flex justify-between text-[10px]"><span className="text-clinical-slate uppercase font-bold">Verified:</span><span className="font-mono text-clinical-green font-bold">T + {selectedLab.availableAt}m</span></div>
                           </div>
                        </div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-clinical-slate/40 text-center italic">
                          <FlaskConical className="w-12 h-12 mb-4 opacity-20" aria-hidden="true" />
                          <p className="text-[10px] uppercase font-bold tracking-widest">Select Lab Row</p>
                          <p className="text-[9px] mt-2">Click on a test to view professional interpretation.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'imaging' && (
              <motion.div key="imaging" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6 flex-1 min-h-0">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
                  <div className="lg:col-span-1 bg-clinical-surface border border-clinical-line rounded flex flex-col overflow-hidden min-h-[200px] max-h-[500px] lg:max-h-none">
                    <div className="bg-clinical-bg p-3 border-b border-clinical-line"><span className="text-[10px] font-bold text-clinical-slate uppercase tracking-widest">Imaging Worklist</span></div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                       {medicalCase?.imaging.map((img, i) => {
                         const isAvailable = img.orderedAt !== undefined && img.availableAt !== undefined && img.availableAt <= simTime;
                         const isPending = img.orderedAt !== undefined && (img.availableAt === undefined || img.availableAt > simTime);
                         return (
                           <button key={i} onClick={() => isAvailable && setRevealedLabs(prev => [...prev, img.type])} aria-label={`${img.type} - ${isAvailable ? 'View results' : isPending ? 'Pending' : 'Not ordered'}`} className={cn("w-full text-left p-3 rounded border transition-all flex flex-col gap-1", revealedLabs.includes(img.type) ? "bg-clinical-blue text-white border-clinical-blue" : "bg-white border-clinical-line hover:border-clinical-blue", isPending && "bg-clinical-bg opacity-70 cursor-wait", !img.orderedAt && "opacity-50")}>
                              <div className="flex justify-between items-center">
                                <span className="text-[11px] font-bold uppercase">{img.type}</span>
                                {isAvailable ? <div className="w-1.5 h-1.5 bg-clinical-green rounded-full" /> : isPending ? <Clock className="w-3 h-3 animate-spin text-clinical-amber" /> : <div className="w-1.5 h-1.5 bg-clinical-slate rounded-full opacity-30" />}
                              </div>
                              <div className="text-[9px] opacity-70 flex justify-between"><span>{isAvailable ? "COMPLETED" : isPending ? "PENDING..." : "UNORDERED"}</span>{img.orderedAt && <span>T + {img.orderedAt}m</span>}</div>
                              {!img.orderedAt && <span onClick={(e) => { e.stopPropagation(); handleOrderDiagnostic('imaging', img.type); }} className="mt-2 text-[9px] text-clinical-blue font-bold uppercase hover:underline">Place Stat Order</span>}
                           </button>
                         );
                       })}
                    </div>
                  </div>
                  <div className="lg:col-span-2 bg-[#0f1115] border border-clinical-line rounded flex flex-col overflow-hidden text-[#d1d5db] min-h-[300px]">
                    <div className="bg-[#1a1c23] p-2 border-b border-[#2d3139] flex items-center justify-between px-4">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#6b7280]">DICOM Viewer v4.2</span>
                      <div className="flex gap-1.5"><div className="w-2 h-2 rounded-full bg-[#f87171] opacity-50" /><div className="w-2 h-2 rounded-full bg-[#fbbf24] opacity-50" /><div className="w-2 h-2 rounded-full bg-[#34d399] opacity-50" /></div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
                      {medicalCase?.imaging.find(img => revealedLabs.includes(img.type)) ? (
                        (() => {
                           const img = medicalCase.imaging.find(img => revealedLabs.includes(img.type))!;
                           return (
                             <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                               <div className="border-b border-[#2d3139] pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-2">
                                 <div><h1 className="text-xl font-bold tracking-tight uppercase text-white">{img.type}</h1><p className="text-[10px] text-[#9ca3af]">TECHNIQUE: {img.technique || 'Standard CT protocol with IV contrast'}</p></div>
                                 <div className="text-left sm:text-right"><p className="text-[10px] font-mono text-[#4b5563]">ACCESSION: #{medicalCase.id.slice(0,6).toUpperCase()}</p><p className="text-[10px] font-mono text-[#4b5563]">STAMP: T + {img.availableAt}m</p></div>
                               </div>
                               <div className="space-y-6">
                                 <section><h2 className="text-[9px] font-bold text-clinical-blue uppercase tracking-widest mb-3 border-b border-clinical-blue/20 pb-1">Clinical Findings</h2><p className="text-sm border-l-2 border-[#2d3139] pl-6 leading-relaxed text-[#9ca3af] whitespace-pre-line font-serif italic">{img.findings || "Reviewing voxel data sequences..."}</p></section>
                                 <section className="bg-[#161a22] p-5 rounded-lg border border-clinical-blue/20 shadow-inner"><h2 className="text-[9px] font-bold text-clinical-red uppercase tracking-widest mb-3">Diagnostic Impression</h2><p className="text-sm font-bold text-white">{img.impression || "Final report pending clinician signature."}</p></section>
                               </div>
                               <div className="pt-12 border-t border-[#2d3139] flex justify-between items-center opacity-20 filter grayscale"><div className="text-[8px] uppercase">Digitally Verified: RAD_SYSTEM_8.0</div><div className="text-[8px] uppercase font-mono tracking-tighter">SECURE RECORD // DO NOT DISTRIBUTE</div></div>
                             </div>
                           );
                        })()
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-[#374151] text-center italic">
                          <FileSearch className="w-16 h-16 mb-4 opacity-10" aria-hidden="true" />
                          <p className="text-[11px] font-bold uppercase tracking-widest opacity-40">Awaiting Image Selection</p>
                          <p className="text-[10px] mt-2 opacity-30 max-w-[180px]">Select a completed diagnostic study from the worklist.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}


            {activeTab === 'pharmacy' && (
              <motion.div key="pharmacy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6 flex-1 min-h-0">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
                  <div className="bg-clinical-surface border border-clinical-line rounded p-4 md:p-6 shadow-sm overflow-y-auto">
                    <h4 className="text-[10px] font-bold text-clinical-slate uppercase tracking-widest mb-4">Stat Medication Catalog</h4>
                    <div className="space-y-6">
                      {[
                        { cat: 'Resuscitation', meds: ['Epinephrine 1mg', 'Amiodarone 300mg', 'Atropine 1mg'] },
                        { cat: 'Fluids / Volume', meds: ['NS 1L Bolus', 'LR 500mL', 'Albumin 25%'] },
                        { cat: 'Analgesia / Sedation', meds: ['Fentanyl 50mcg', 'Propofol 20mg', 'Morphine 4mg'] },
                        { cat: 'Cardiovascular', meds: ['Nitroglycerin 0.4mg SL', 'Aspirin 324mg PO', 'Heparin 5000u Bolus'] }
                      ].map((group, idx) => (
                        <div key={idx} className="space-y-2">
                          <label className="text-[8px] font-bold text-clinical-slate opacity-40 uppercase">{group.cat}</label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
                            {group.meds.map(med => (
                              <button key={med} onClick={() => handlePerformIntervention(2, `Administer ${med}`)} disabled={intervening} aria-label={`Administer ${med}`} className="flex justify-between items-center p-3 bg-white border border-clinical-line rounded hover:border-clinical-blue hover:bg-clinical-blue/5 transition-all text-xs font-medium disabled:opacity-50">
                                <span>{med}</span>
                                <Plus className="w-3 h-3 text-clinical-blue" />
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Fix: replaced document.getElementById with React state */}
                  <div className="bg-clinical-surface border border-clinical-line rounded p-4 md:p-6 shadow-sm flex flex-col">
                    <h4 className="text-[10px] font-bold text-clinical-slate uppercase tracking-widest mb-4">Current Order Workflow</h4>
                    <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 border-2 border-dashed border-clinical-line rounded text-center">
                      <StethIcon className="w-12 h-12 mb-4 opacity-40" aria-hidden="true" />
                      <p className="text-xs font-bold uppercase mb-4">Custom Pharmacy Order</p>
                      <div className="w-full flex gap-2">
                        <input
                          type="text"
                          value={customMedInput}
                          onChange={(e) => setCustomMedInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter' && customMedInput) { handlePerformIntervention(2, `Administer ${customMedInput}`); setCustomMedInput(''); } }}
                          placeholder="Drug Name (e.g. Norepinephrine)"
                          aria-label="Custom medication name"
                          className="flex-1 bg-white border border-clinical-line rounded p-2 text-xs focus:outline-none focus:border-clinical-blue focus:ring-1 focus:ring-clinical-blue"
                        />
                        <button
                          onClick={() => { if (customMedInput) { handlePerformIntervention(2, `Administer ${customMedInput}`); setCustomMedInput(''); } }}
                          disabled={!customMedInput || intervening}
                          aria-label="Administer custom medication"
                          className="bg-clinical-blue text-white px-4 py-2 rounded text-[10px] font-bold uppercase disabled:opacity-50"
                        >
                          GiveStat
                        </button>
                      </div>
                      <p className="text-[9px] mt-4 max-w-[200px] text-clinical-slate">Select a preset medication or enter a custom drug and dose for immediate administration.</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'comms' && (
              <motion.div key="comms" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6 flex-1 min-h-0">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 shrink-0">
                  <div className="md:col-span-1 bg-clinical-surface border border-clinical-line rounded p-4 flex flex-col gap-4">
                    <h3 className="text-[10px] font-bold text-clinical-slate uppercase tracking-widest border-b border-clinical-line pb-2">Hospital Directory</h3>
                    <div className="space-y-1 overflow-y-auto max-h-[200px] pr-2" role="listbox" aria-label="Staff contacts">
                      {STAFF_TARGETS.map(target => (
                        <button key={target} onClick={() => setCallTarget(target)} role="option" aria-selected={callTarget === target} className={cn("w-full text-left px-3 py-2 rounded text-xs transition-colors flex items-center justify-between", callTarget === target ? "bg-clinical-blue text-white font-bold" : "text-clinical-slate hover:bg-clinical-bg")}>
                          {target}
                          {callTarget === target && <Phone className="w-3 h-3" />}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="md:col-span-2 bg-clinical-surface border border-clinical-line rounded p-4 flex flex-col gap-4">
                    <h3 className="text-[10px] font-bold text-clinical-slate uppercase tracking-widest border-b border-clinical-line pb-2">Initiate Call: {callTarget}</h3>
                    <div className="flex gap-2 md:gap-4">
                      <input type="text" value={callMessage} onChange={(e) => setCallMessage(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleStaffCall()} placeholder={`Message for ${callTarget}...`} aria-label={`Message for ${callTarget}`} className="flex-1 bg-clinical-bg border border-clinical-line rounded px-3 md:px-4 py-3 text-sm focus:outline-none focus:border-clinical-blue focus:ring-1 focus:ring-clinical-blue transition-all" />
                      <button onClick={handleStaffCall} disabled={calling || !callMessage} aria-label="Send message" className="px-4 md:px-6 bg-clinical-blue text-white rounded font-bold uppercase text-[11px] tracking-widest hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center gap-2">
                        {calling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        <span className="hidden sm:inline">Send</span>
                      </button>
                    </div>
                    <p className="text-[10px] text-clinical-slate italic">Note: Formal documentation will be added to patient EHR record automatically.</p>
                  </div>
                </div>
                <div className="flex-1 bg-clinical-surface border border-clinical-line rounded shadow-sm flex flex-col overflow-hidden min-h-[250px]">
                  <div className="bg-clinical-bg p-3 border-b border-clinical-line flex items-center justify-between">
                    <span className="text-[11px] font-bold text-clinical-slate uppercase">Interaction History</span>
                    <span className="text-[10px] text-clinical-slate italic select-none hidden sm:block">Secure Communication Line 582</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-[#f8f9fa]">
                    {(medicalCase?.communicationLog || []).length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center opacity-20 italic"><MessageSquare className="w-12 h-12 mb-4" aria-hidden="true" /><p className="text-xs">No current active threads</p></div>
                    ) : (
                      medicalCase.communicationLog.map((msg, i) => (
                        <div key={i} className={cn("max-w-[85%] md:max-w-[80%] flex flex-col gap-1", msg.from === 'You' || msg.from === 'Physician' ? "ml-auto items-end" : "mr-auto items-start")}>
                          <div className="text-[9px] font-bold text-clinical-slate uppercase px-1">{msg.from} → {msg.to}</div>
                          <div className={cn("p-3 rounded-lg text-sm shadow-sm", msg.from === 'You' || msg.from === 'Physician' ? "bg-clinical-blue text-white rounded-tr-none" : "bg-white border border-clinical-line rounded-tl-none text-clinical-ink")}>{msg.message}</div>
                          <div className="text-[9px] text-clinical-slate font-mono px-1">T + {msg.timestamp} min</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </motion.div>
            )}


            {activeTab === 'treatment' && (
               <motion.div key="treatment" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                  <div className="space-y-6">
                     <div className="bg-clinical-surface border border-clinical-line rounded p-4 md:p-6 shadow-sm">
                        <label className="text-[10px] font-bold text-clinical-slate uppercase block mb-3 tracking-widest" htmlFor="cpoe-input">Electronic Order Entry (CPOE)</label>
                        <textarea id="cpoe-input" value={interventionInput} onChange={(e) => setInterventionInput(e.target.value)} placeholder="Select med, dose, route, and frequency..." className="w-full h-28 md:h-32 bg-clinical-bg border border-clinical-line rounded p-4 text-sm font-medium focus:outline-none focus:border-clinical-blue focus:ring-1 focus:ring-clinical-blue transition-all resize-none" />
                        <div className="mt-4 flex gap-3">
                           <button onClick={() => handlePerformIntervention()} disabled={intervening || !interventionInput} className="flex-1 py-3 bg-clinical-ink text-white rounded font-bold text-[11px] uppercase tracking-widest hover:bg-clinical-slate transition-all disabled:opacity-30">Execute Order</button>
                           <button onClick={() => handlePerformIntervention(10)} disabled={intervening} className="px-4 md:px-6 border border-clinical-line text-clinical-slate rounded font-bold text-[11px] uppercase hover:bg-clinical-bg transition-all">Wait 10m</button>
                        </div>
                     </div>
                     <div className="bg-clinical-surface border border-clinical-line rounded p-4 md:p-6 shadow-sm">
                        <label className="text-[10px] font-bold text-clinical-slate uppercase block mb-3 tracking-widest" htmlFor="soap-note">Assessment & Plan (Soap Note)</label>
                        <textarea id="soap-note" placeholder="Enter clinical reasoning and long-term diagnostic plan..." className="w-full h-20 md:h-24 bg-clinical-bg border border-clinical-line rounded p-4 text-xs font-serif italic focus:outline-none focus:border-clinical-blue focus:ring-1 focus:ring-clinical-blue transition-all resize-none shadow-inner" />
                        <p className="text-[9px] text-clinical-slate mt-2 opacity-60">Personal documentation only - does not trigger simulation changes.</p>
                     </div>
                     <div className="bg-clinical-surface border border-clinical-line rounded p-4 md:p-6 shadow-sm">
                        <label className="text-[10px] font-bold text-clinical-slate uppercase block mb-3 tracking-widest">Medication Administration Record (MAR)</label>
                        <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2">
                          {(medicalCase?.medications || []).length === 0 ? (
                            <div className="py-8 text-center text-[10px] text-clinical-slate uppercase italic opacity-40 border border-dashed border-clinical-line rounded">No Meds Administered</div>
                          ) : (
                            medicalCase?.medications.map((med, i) => (
                              <div key={i} className="flex items-center justify-between p-3 bg-clinical-bg border border-clinical-line rounded text-xs">
                                <div className="flex items-center gap-3"><div className="w-2 h-2 bg-clinical-blue rounded-full" aria-hidden="true" /><span className="font-bold">{med.name}</span><span className="opacity-60">{med.dose || '-'} {med.route ? `via ${med.route}` : ''}</span></div>
                                <span className="font-mono text-[9px] text-clinical-slate underline">T + {med.timestamp}m</span>
                              </div>
                            ))
                          )}
                        </div>
                     </div>
                     <div className="bg-clinical-surface border border-clinical-line rounded p-4 md:p-6 shadow-sm">
                        <label className="text-[10px] font-bold text-clinical-slate uppercase block mb-3 tracking-widest">Rapid Transfer / Admission</label>
                        <div className="grid grid-cols-2 gap-2 md:gap-3 pb-4 md:pb-6 border-b border-clinical-line mb-4 md:mb-6">
                           {['Intensive Care (ICU)', 'OR / Surgery', 'Cardiac Cath Lab', 'General Ward', 'Radiology (CT/MRI)'].map(dept => (
                             <button key={dept} onClick={() => handlePerformIntervention(0, `Transfer to ${dept}`)} disabled={intervening} aria-label={`Transfer to ${dept}`} className="py-2 px-2 md:px-3 border border-clinical-line rounded text-[9px] md:text-[10px] font-bold text-clinical-slate uppercase hover:bg-clinical-blue hover:text-white hover:border-clinical-blue transition-all flex items-center gap-1 md:gap-2 disabled:opacity-50">
                               <UserPlus className="w-3 h-3 shrink-0" /><span className="truncate">{dept}</span>
                             </button>
                           ))}
                        </div>
                        <label className="text-[10px] font-bold text-clinical-slate uppercase block mb-3 tracking-widest">Simulation Timeline</label>
                        <div className="grid grid-cols-2 gap-3">
                           <button onClick={() => handlePerformIntervention(15, 'Observe patient')} disabled={intervening} className="py-2 px-3 border border-clinical-line rounded text-[10px] font-bold text-clinical-slate uppercase hover:bg-clinical-ink hover:text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50"><Clock className="w-3 h-3" />Wait 15m</button>
                           <button onClick={() => handlePerformIntervention(60, 'Periodic monitoring')} disabled={intervening} className="py-2 px-3 border border-clinical-line rounded text-[10px] font-bold text-clinical-slate uppercase hover:bg-clinical-ink hover:text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50"><Clock className="w-3 h-3" />Wait 1h</button>
                        </div>
                     </div>
                     <div className="bg-clinical-ink text-clinical-green p-4 md:p-6 rounded shadow-lg font-mono">
                        <div className="flex justify-between items-center mb-4 border-b border-clinical-green/20 pb-2">
                           <span className="text-[10px] uppercase font-bold tracking-widest">Vital Stream</span>
                           <div className="w-2 h-2 rounded-full bg-clinical-green animate-pulse" aria-hidden="true" />
                        </div>
                        <div className="h-32 md:h-40">
                           <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={vitalsHistory}>
                                 <Line type="stepAfter" dataKey="hr" stroke="#38A169" strokeWidth={2} dot={false} isAnimationActive={false} />
                                 <YAxis hide domain={['dataMin - 5', 'dataMax + 5']} />
                                 <Tooltip content={({ payload }) => <div className="text-[10px] text-zinc-400">{payload?.[0]?.value} BPM</div>} />
                              </LineChart>
                           </ResponsiveContainer>
                        </div>
                     </div>
                  </div>
                  <div className="space-y-6">
                      <div className="bg-clinical-surface border border-clinical-line rounded shadow-sm overflow-hidden flex flex-col">
                        <div className="bg-clinical-bg p-3 border-b border-clinical-line flex justify-between items-center">
                           <span className="text-[10px] font-bold text-clinical-slate uppercase tracking-widest">Fluid Balance & I/O</span>
                           <div className="flex items-center gap-1"><span className="text-[9px] text-clinical-slate uppercase">Net:</span><span className={cn("text-xs font-mono font-bold", (medicalCase?.medications.length || 0) * 200 > 500 ? "text-clinical-blue" : "text-clinical-ink")}>+{(medicalCase?.medications.length || 0) * 200} mL</span></div>
                        </div>
                        <div className="p-4 md:p-6 flex-1 flex flex-col gap-6">
                            <div className="flex justify-between items-end gap-2 h-24" aria-hidden="true">
                               <div className="flex-1 bg-clinical-bg border border-clinical-line rounded-t relative overflow-hidden"><div className="absolute bottom-0 left-0 right-0 bg-clinical-blue/20 transition-all duration-1000" style={{ height: `${Math.min(100, (medicalCase?.medications.length || 0) * 10 + 20)}%` }} /><div className="absolute inset-0 flex items-center justify-center text-[7px] font-bold text-clinical-slate uppercase tracking-tighter z-10 text-center px-1">Total Intake</div></div>
                               <div className="flex-1 bg-clinical-bg border border-clinical-line rounded-t relative overflow-hidden"><div className="absolute bottom-0 left-0 right-0 bg-clinical-amber/20 transition-all duration-1000" style={{ height: '35%' }} /><div className="absolute inset-0 flex items-center justify-center text-[7px] font-bold text-clinical-slate uppercase tracking-tighter z-10 text-center px-1">Urine Output</div></div>
                            </div>
                            <div className="space-y-2 pt-2">
                               <div className="flex justify-between text-[10px]"><span className="text-clinical-slate font-bold uppercase opacity-60">Maintenance Fluids:</span><span className="font-mono">NS @ 80 mL/hr</span></div>
                               <div className="flex justify-between text-[10px]"><span className="text-clinical-slate font-bold uppercase opacity-60">Stat Boluses:</span><span className="font-mono text-clinical-blue">+{(medicalCase?.medications.filter(m => m.name.includes('Bolus') || m.name.includes('NS') || m.name.includes('LR')).length || 0) * 500} mL</span></div>
                            </div>
                        </div>
                      </div>
                      <div className="bg-clinical-surface border border-clinical-line rounded shadow-sm flex flex-col min-h-[300px] max-h-[400px]">
                          <div className="bg-clinical-bg p-3 border-b border-clinical-line text-[11px] font-bold text-clinical-slate uppercase">Intervention Chronology</div>
                          <div className="flex-1 overflow-y-auto p-4 space-y-4">
                             {(medicalCase?.clinicalActions || []).length === 0 ? (
                               <div className="h-full flex flex-col items-center justify-center opacity-20 italic"><History className="w-12 h-12 mb-4" aria-hidden="true" /><p className="text-xs">Timeline Empty</p></div>
                             ) : (
                               (medicalCase?.clinicalActions || []).map((a, i) => (
                                 <div key={i} className="flex gap-4 group">
                                    <div className="text-[10px] font-mono text-clinical-slate w-12 pt-1 border-r border-clinical-line shrink-0">T+{a.timestamp}</div>
                                    <div className="flex-1 pb-4"><p className="text-xs font-bold text-clinical-ink leading-tight mb-1">{a.description}</p><p className="text-clinical-slate border-l-2 border-clinical-blue/30 pl-4 py-1 italic text-[10px]">{a.impact || a.result}</p></div>
                                 </div>
                               ))
                             )}
                          </div>
                      </div>
                  </div>
               </motion.div>
            )}

            {activeTab === 'archive' && (
              <motion.div key="archive" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6">
                <div className="bg-clinical-surface border border-clinical-line rounded shadow-sm overflow-hidden">
                  <div className="bg-clinical-bg p-3 border-b border-clinical-line flex justify-between items-center">
                    <span className="text-[11px] font-bold text-clinical-slate uppercase tracking-wider">Patient Simulation Archive</span>
                    <span className="text-[9px] text-clinical-slate uppercase font-bold opacity-60 hidden sm:block">Records for {user?.email || 'Unauthorized'}</span>
                  </div>
                  <ArchiveView user={user} />
                </div>
              </motion.div>
            )}
            {activeTab === 'notes' && (<motion.div key="notes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 min-h-0"><ClinicalNotes /></motion.div>)}
            {activeTab === 'tools' && (<motion.div key="tools" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 min-h-0"><ClinicalGuidelines /></motion.div>)}
          </AnimatePresence>


          {/* Diagnostic Console - Bottom Persistent */}
          <footer className="mt-auto bg-clinical-surface border border-clinical-line rounded p-4 md:p-6 shadow-md shrink-0">
             <div className="flex justify-between items-center mb-4 md:mb-6">
                <h3 className="text-[11px] font-bold text-clinical-slate uppercase tracking-widest flex items-center gap-2">
                  <Stethoscope className="w-3 h-3" aria-hidden="true" />
                  Attending's Assessment & Plan
                </h3>
                {feedback && <div className="px-3 py-1 bg-clinical-blue text-white rounded text-[10px] font-bold">CASE TERMINATED</div>}
             </div>

             {!feedback && (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 mb-4 md:mb-6">
                 <div>
                    <label className="text-[9px] font-bold text-clinical-slate uppercase mb-2 block" htmlFor="differential-input">Working Differential</label>
                    <textarea id="differential-input" placeholder={"1. Septic Shock\n2. Pulmonary Embolism\n3. Hypovolemic Shock"} className="w-full h-20 bg-clinical-bg border border-clinical-line rounded p-4 text-xs font-mono focus:outline-none focus:border-clinical-blue focus:ring-1 focus:ring-clinical-blue transition-all resize-none shadow-inner" />
                 </div>
                 <div>
                    <label className="text-[9px] font-bold text-clinical-slate uppercase mb-2 block">Confirmatory Findings</label>
                    <div className="flex flex-wrap gap-2">
                       {medicalCase?.labs.filter(l => l.status === 'critical').map(l => (
                         <span key={l.name} className="px-2 py-1 bg-clinical-red/10 text-clinical-red text-[9px] font-bold rounded flex items-center gap-1"><AlertTriangle className="w-2 h-2" aria-hidden="true" /> {l.name}: {l.value}</span>
                       ))}
                       {medicalCase?.imaging.filter(i => i.availableAt && i.availableAt <= simTime).map(i => (
                         <span key={i.type} className="px-2 py-1 bg-clinical-blue/10 text-clinical-blue text-[9px] font-bold rounded">{i.type} (+)</span>
                       ))}
                    </div>
                 </div>
               </div>
             )}

             {feedback ? (
               <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex flex-col sm:flex-row gap-4 md:gap-8 items-center sm:items-start text-center sm:text-left">
                    <div className="w-20 h-20 rounded-full border-4 border-clinical-bg flex items-center justify-center relative shrink-0" aria-label={`Score: ${feedback.score}%`}>
                        <svg className="absolute inset-0 w-full h-full -rotate-90" aria-hidden="true"><circle cx="40" cy="40" r="36" fill="none" stroke="#EDF2F7" strokeWidth="4" /><circle cx="40" cy="40" r="36" fill="none" stroke="#2B6CB0" strokeWidth="4" strokeDasharray={`${feedback.score * 2.26} 226`} /></svg>
                        <span className="text-xl font-black text-clinical-ink">{feedback.score}</span>
                    </div>
                    <div className="flex-1">
                        <h4 className="text-xs font-black text-clinical-blue uppercase tracking-widest mb-2">Simulation Outcome: {feedback.score >= 80 ? 'Success' : 'Review Required'}</h4>
                        <div className="bg-clinical-bg p-4 rounded-lg border border-clinical-line border-l-4 border-l-clinical-blue mb-4"><p className="text-[11px] leading-relaxed text-clinical-ink italic whitespace-pre-wrap">"{feedback.feedback}"</p></div>
                        <p className="text-[10px] text-clinical-slate uppercase font-bold">Standard of Care Diagnosis: <span className="text-clinical-ink ml-1">{medicalCase?.correctDiagnosis}</span></p>
                    </div>
                  </div>
                  <div className="border-t border-clinical-line pt-4 md:pt-6">
                    <h5 className="text-[9px] font-black text-clinical-slate uppercase tracking-widest mb-4">Clinical Action Audit</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-2">
                      {medicalCase?.clinicalActions.map((action, i) => (
                        <div key={i} className="flex gap-3 text-[10px] bg-white p-2 rounded border border-clinical-line shadow-sm"><span className="font-mono text-clinical-blue font-bold">T+{action.timestamp}</span><span className="text-clinical-ink leading-tight">{action.description}</span></div>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-center pt-2">
                    <button onClick={() => loadNewCase()} className="px-8 md:px-10 py-3 bg-clinical-blue text-white rounded font-bold uppercase text-[10px] tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-clinical-blue/20">Admit Next Patient</button>
                  </div>
               </div>
             ) : (
               <div className="flex flex-col sm:flex-row gap-4">
                  <textarea value={userDiagnosis} onChange={(e) => setUserDiagnosis(e.target.value)} placeholder="Enter final working diagnosis and disposition plan..." aria-label="Final diagnosis input" className="flex-1 h-20 bg-clinical-bg border border-clinical-line rounded p-4 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-clinical-blue transition-all" />
                  <button onClick={handleSubmitDiagnosis} disabled={submitting || !userDiagnosis} aria-label="Submit diagnosis" className="h-14 sm:h-20 px-8 bg-clinical-blue hover:bg-blue-700 text-white rounded flex flex-row sm:flex-col items-center justify-center gap-2 sm:gap-1 transition-all disabled:opacity-50 shrink-0">
                    <CheckCircle2 className="w-5 h-5" /><span className="text-[10px] font-bold uppercase tracking-widest">Commit</span>
                  </button>
               </div>
             )}
          </footer>
        </main>
      </div>

      {/* AI Consultant Slide-over */}
      <AnimatePresence>
        {isConsultOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsConsultOpen(false)} className="fixed inset-0 bg-clinical-ink/40 backdrop-blur-sm z-[100]" aria-hidden="true" />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} role="dialog" aria-modal="true" aria-label="AI Consultant Panel" className="fixed top-0 right-0 bottom-0 w-full max-w-lg bg-white border-l border-clinical-line z-[101] shadow-2xl flex flex-col">
              <div className="h-16 bg-clinical-ink text-white px-4 md:px-6 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-clinical-amber/20 flex items-center justify-center" aria-hidden="true"><Brain className="w-5 h-5 text-clinical-amber" /></div>
                  <div><h3 className="text-sm font-black uppercase tracking-widest">Medical Board Consult</h3><p className="text-[10px] opacity-60 uppercase font-bold">Specialist Clinical Reasoning</p></div>
                </div>
                <button onClick={() => setIsConsultOpen(false)} className="p-2 hover:bg-white/10 rounded transition-colors" aria-label="Close consultant panel"><X className="w-5 h-5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8">
                {isConsulting ? (
                  <div className="h-full flex flex-col items-center justify-center gap-6 text-clinical-slate" role="status">
                    <div className="relative"><div className="w-20 h-20 rounded-full border-t-2 border-clinical-blue animate-spin" /><Brain className="absolute inset-0 m-auto w-10 h-10 opacity-20 animate-pulse" /></div>
                    <div className="text-center"><p className="text-[10px] font-black uppercase tracking-[0.2em] mb-2">Analyzing Clinical Patterns</p><p className="text-xs italic opacity-60">"Retrieving latest clinical guidelines..."</p></div>
                  </div>
                ) : consultantAdvice ? (
                  <>
                    <section className="space-y-4"><label className="text-[10px] font-black text-clinical-blue uppercase tracking-widest flex items-center gap-2"><Sparkles className="w-3 h-3" /> Expert Impression</label><div className="p-4 md:p-6 bg-clinical-bg border-l-4 border-clinical-blue rounded-r-xl shadow-sm italic text-sm font-serif leading-relaxed text-clinical-ink">"{consultantAdvice.advice}"</div></section>
                    <section className="space-y-4"><label className="text-[10px] font-black text-clinical-slate uppercase tracking-widest">Diagnostic Reasoning</label><p className="text-[13px] text-clinical-ink leading-relaxed font-medium">{consultantAdvice.reasoning}</p></section>
                    <section className="space-y-4"><label className="text-[10px] font-black text-clinical-amber uppercase tracking-widest flex items-center gap-2"><Zap className="w-3 h-3" /> Recommended Priorities</label><div className="space-y-2">{consultantAdvice.recommendedActions.map((action, i) => (<div key={i} className="flex items-start gap-4 p-4 bg-clinical-amber/5 border border-clinical-amber/10 rounded-lg group"><div className="w-6 h-6 rounded-full bg-clinical-amber text-white flex items-center justify-center text-[10px] font-black shrink-0 shadow-sm">{i + 1}</div><p className="text-xs font-bold text-clinical-ink mt-1 group-hover:translate-x-1 transition-transform">{action}</p></div>))}</div></section>
                    <div className="p-4 md:p-6 bg-blue-50 border border-blue-100 rounded-xl"><p className="text-[10px] text-blue-800 leading-relaxed font-medium"><strong className="uppercase tracking-widest block mb-1">Disclaimer:</strong>This simulation advice is AI-generated for educational purposes. Always correlate with bedside presentation and institutional protocols.</p></div>
                  </>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center gap-4 text-clinical-slate opacity-40"><AlertCircle className="w-12 h-12 mb-2" aria-hidden="true" /><p className="text-xs uppercase font-black tracking-widest">No Advice Generated</p></div>
                )}
              </div>
              <div className="p-4 md:p-6 bg-clinical-bg border-t border-clinical-line">
                <button onClick={() => setIsConsultOpen(false)} className="w-full h-12 bg-clinical-ink text-white rounded font-black uppercase text-[10px] tracking-widest hover:bg-clinical-blue transition-all">Return to Patient Bedside</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
