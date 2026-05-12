/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, Component, ErrorInfo, ReactNode } from 'react';
import { 
  Heart, 
  Activity, 
  Wind, 
  Droplets, 
  Clipboard, 
  Stethoscope, 
  FlaskConical, 
  Pill,
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
  ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { MedicalCase, Vitals, LabResult, CommunicationMessage } from './types';
import { generateMedicalCase, evaluateDiagnosis, performIntervention, staffCall } from './services/apiService';
import { saveSimulationResult, getRecentSimulations } from './services/storageService';
import { getSupabase } from './lib/supabase';
import type { User } from './lib/supabase';
import { AuthModal } from './components/Auth';
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
            <AlertCircle className="w-12 h-12 text-clinical-red mx-auto mb-4" />
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

function ArchiveView({ user }: { user: User | null }) {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      getRecentSimulations()
        .then(setRecords)
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [user]);

  if (!user) {
    return (
      <div className="p-12 text-center text-clinical-slate flex flex-col items-center">
        <ShieldAlert className="w-10 h-10 mb-4 opacity-20" />
        <p className="text-xs uppercase font-black tracking-widest text-clinical-ink">Authentication Required</p>
        <p className="text-[10px] mt-2 mb-6 max-w-[240px]">Clinical archives are encrypted and restricted to authorized personnel. Please sign in to view your simulation history.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center gap-4 text-clinical-slate">
        <Loader2 className="w-6 h-6 animate-spin text-clinical-blue" />
        <span className="text-[10px] uppercase font-bold tracking-widest text-clinical-ink">Retrieving clinical records...</span>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="p-12 text-center text-clinical-slate opacity-40">
        <History className="w-10 h-10 mx-auto mb-4 opacity-10" />
        <p className="text-xs uppercase font-bold tracking-widest">Archive Empty</p>
        <p className="text-[10px] mt-2">Complete simulations to preserve clinical history.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="clinical-table w-full">
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Patient</th>
            <th>Difficulty</th>
            <th>Category</th>
            <th>Outcome</th>
            <th>DX (Correct)</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r, i) => (
            <tr key={i} className="hover:bg-clinical-bg/30">
              <td className="text-[10px] font-mono whitespace-nowrap">
                {new Date(r.created_at).toLocaleDateString()} {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </td>
              <td className="font-bold text-clinical-ink">{r.patient_name} <span className="font-normal opacity-50">({r.age}y)</span></td>
              <td>
                <span className={cn(
                  "text-[9px] font-black px-1.5 py-0.5 rounded uppercase",
                  r.difficulty === 'attending' ? "bg-clinical-red/10 text-clinical-red" : 
                  r.difficulty === 'resident' ? "bg-clinical-amber/10 text-clinical-amber" : "bg-clinical-green/10 text-clinical-green"
                )}>{r.difficulty}</span>
              </td>
              <td className="text-[10px] uppercase font-bold text-clinical-slate">{r.category}</td>
              <td>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-xs font-black",
                    r.score >= 80 ? "text-clinical-green" : "text-clinical-amber"
                  )}>{r.score}%</span>
                  <div className="w-16 h-1.5 bg-clinical-bg rounded-full overflow-hidden">
                    <div className={cn("h-full", r.score >= 80 ? "bg-clinical-green" : "bg-clinical-amber")} style={{ width: `${r.score}%` }} />
                  </div>
                </div>
              </td>
              <td className="text-[10px] font-medium text-clinical-slate italic">"{r.correct_diagnosis}"</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClinicalSimulator() {
  const [medicalCase, setMedicalCase] = useState<MedicalCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'hpi' | 'exam' | 'labs' | 'imaging' | 'pharmacy' | 'treatment' | 'comms' | 'archive'>('hpi');
  const [userDiagnosis, setUserDiagnosis] = useState('');
  const [interventionInput, setInterventionInput] = useState('');
  const [feedback, setFeedback] = useState<{ score: number; feedback: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [intervening, setIntervening] = useState(false);
  const [calling, setCalling] = useState(false);
  const [callTarget, setCallTarget] = useState('Nursing Station');
  const [callMessage, setCallMessage] = useState('');
  const [customMedInput, setCustomMedInput] = useState('');
  const [vitalsHistory, setVitalsHistory] = useState<{ time: string; hr: number; sbp: number; rr: number; spo2: number }[]>([]);
  const [gcsState, setGcsState] = useState({ eyes: 4, verbal: 5, motor: 6 });
  const [revealedLabs, setRevealedLabs] = useState<string[]>([]);
  const [selectedLab, setSelectedLab] = useState<LabResult | null>(null);
  const [logs, setLogs] = useState<{ time: string; text: string }[]>([]);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isSupabaseConfigured, setIsSupabaseConfigured] = useState(true);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    setIsSupabaseConfigured(!!supabase);

    if (supabase) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        setUser(user);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
      });

      return () => subscription.unsubscribe();
    }
  }, []);

  const handleLogout = async () => {
    const supabase = getSupabase();
    if (supabase) {
      await supabase.auth.signOut();
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
        const newEntry = {
          time: `T+${medicalCase.simulationTime}`,
          hr: medicalCase.vitals.heartRate,
          sbp: sys,
          rr: medicalCase.vitals.respiratoryRate,
          spo2: medicalCase.vitals.oxygenSaturation
        };
        // Avoid duplicate entries if simulation time hasn't changed
        if (prev.length > 0 && prev[prev.length - 1].time === newEntry.time) return prev;
        const updated = [...prev, newEntry];
        return updated.slice(-15);
      });
    }
  }, [medicalCase?.simulationTime, medicalCase?.vitals]);

  const STAFF_TARGETS = [
    'Nursing Station',
    'Radiology Desk',
    'Laboratory Tech',
    'Cardiology Consult',
    'Surgery Resident',
    'ICU Attending',
    'Pharmacy',
    'Social Work'
  ];

  const loadNewCase = useCallback(async (difficulty?: string, category?: string) => {
    setLoading(true);
    setError(null);
    setFeedback(null);
    setUserDiagnosis('');
    setRevealedLabs([]);
    setLogs([{ time: new Date().toLocaleTimeString(), text: 'ADMIT: Patient registered in system.' }]);
    try {
      const history = await getRecentSimulations();
      const newCase = await generateMedicalCase(difficulty, category, history);
      setMedicalCase(newCase);
      const hrBase = newCase.vitals?.heartRate || 75;
      const sysBase = parseInt(newCase.vitals?.bloodPressure.split('/')[0]) || 120;
      const rrBase = newCase.vitals?.respiratoryRate || 16;
      const spo2Base = newCase.vitals?.oxygenSaturation || 98;
      
      const initialHistory = Array.from({ length: 10 }, (_, i) => ({
        time: `T-${10-i}m`,
        hr: hrBase + (Math.random() * 4 - 2),
        sbp: sysBase + (Math.random() * 6 - 3),
        rr: rrBase + (Math.random() * 2 - 1),
        spo2: Math.min(100, spo2Base + (Math.random() * 1 - 0.5))
      }));
      setVitalsHistory(initialHistory);
      setIsLibraryOpen(false);
    } catch (error) {
      console.error("Failed to generate case:", error);
      setError(error instanceof Error ? error.message : "Clinical database connection failure.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNewCase();
  }, [loadNewCase]);

  useEffect(() => {
    if (!medicalCase) return;
    const interval = setInterval(() => {
      setVitalsHistory(prev => {
        const last = prev[prev.length - 1];
        if (!last) return prev;
        
        const next = [...prev.slice(1), {
          time: new Date().toLocaleTimeString(),
          hr: (medicalCase?.vitals?.heartRate || 75) + (Math.random() * 2 - 1),
          sbp: last.sbp + (Math.random() * 1 - 0.5),
          rr: last.rr + (Math.random() * 0.4 - 0.2),
          spo2: Math.min(100, last.spo2 + (Math.random() * 0.2 - 0.1))
        }];
        return next;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [medicalCase]);

  const handlePerformIntervention = async (customWait?: number, directIntervention?: string) => {
    if (!medicalCase && !directIntervention) return;
    if (!medicalCase) return;
    
    setIntervening(true);
    const interventionToExecute = directIntervention || interventionInput || "Observation";
    const actionText = directIntervention ? `ACTION: ${directIntervention}` : (customWait ? `WAIT ${customWait} min` : `ORDER: ${interventionInput}`);
    
    setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), text: actionText }]);
    try {
      const updatedCase = await performIntervention(interventionToExecute, medicalCase, customWait || 5);
      // Merge logic: ensure we don't lose existing data if AI forgets fields
      setMedicalCase(prev => {
        if (!prev) return updatedCase;
        return {
          ...prev,
          ...updatedCase,
          // Deep merge critical arrays if AI returned truncated versions
          labs: updatedCase.labs || prev.labs,
          imaging: updatedCase.imaging || prev.imaging,
          clinicalActions: updatedCase.clinicalActions || prev.clinicalActions,
          vitals: { ...prev.vitals, ...(updatedCase.vitals || {}) }
        };
      });
      setInterventionInput('');
      setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), text: `RESULT: State evolved.` }]);
    } catch (error) {
      console.error("Intervention failed:", error);
    } finally {
      setIntervening(false);
    }
  };

  const handleSubmitDiagnosis = async () => {
    if (!medicalCase || !userDiagnosis) return;
    setSubmitting(true);
    try {
      const result = await evaluateDiagnosis(userDiagnosis, medicalCase);
      setFeedback(result);
      setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), text: `DIAGNOSIS FILED: ${userDiagnosis}` }]);
      
      // Save to Supabase (non-blocking)
      saveSimulationResult(medicalCase, userDiagnosis, result.score, result.feedback)
        .catch(err => console.error("Persistence failed:", err));
        
    } catch (error) {
      console.error("Failed to evaluate diagnosis:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStaffCall = async () => {
    if (!medicalCase || !callMessage) return;
    setCalling(true);
    try {
      const { reply, updatedCase } = await staffCall(callTarget, callMessage, medicalCase);
      setMedicalCase(updatedCase);
      setCallMessage('');
      setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), text: `COMM: Call to ${callTarget} - "${reply.slice(0, 30)}..."` }]);
    } catch (err) {
      console.error(err);
    } finally {
      setCalling(false);
    }
  };

  const handleOrderDiagnostic = async (type: 'lab' | 'imaging', name: string) => {
    if (!medicalCase) return;
    setIntervening(true);
    setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), text: `ORDERED: ${name}` }]);
    
    // Simulate ordering: The server will set orderedAt and availableAt
    try {
      const updatedCase = await performIntervention(`Order ${type}: ${name}`, medicalCase, 1);
      setMedicalCase(updatedCase);
    } catch (err) {
      console.error(err);
    } finally {
      setIntervening(false);
    }
  };

  if (loading || error) {
    return (
      <div className="min-h-screen bg-clinical-bg flex items-center justify-center font-sans relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-clinical-blue/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-clinical-green/5 rounded-full blur-3xl" />
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex flex-col items-center gap-8 max-w-md text-center relative z-10">
          {error ? (
            <div className="p-10 bg-clinical-surface border border-clinical-line rounded-2xl shadow-elevated w-full">
              <div className="w-16 h-16 bg-clinical-red/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-8 h-8 text-clinical-red" />
              </div>
              <h2 className="text-xl font-bold mb-2 text-clinical-ink">System Fault</h2>
              <p className="text-sm text-clinical-slate mb-8 leading-relaxed">{error}</p>
              <button onClick={() => loadNewCase()} className="w-full py-3 bg-clinical-blue hover:bg-clinical-blue/90 text-white rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-clinical-blue/20">
                <RefreshCw className="w-4 h-4" /> Restart Station
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-6">
              {/* ECG-style loading animation */}
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-clinical-surface border border-clinical-line shadow-elevated flex items-center justify-center">
                  <Activity className="w-8 h-8 text-clinical-blue animate-pulse" />
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-clinical-green rounded-full border-2 border-clinical-bg animate-ping" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-clinical-ink">Initializing Clinical Station</p>
                <p className="text-xs text-clinical-slate">Generating patient scenario via AI engine...</p>
              </div>
              {/* Progress bar */}
              <div className="w-48 h-1 bg-clinical-line rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-clinical-blue rounded-full"
                  initial={{ width: "0%" }}
                  animate={{ width: "70%" }}
                  transition={{ duration: 3, ease: "easeInOut" }}
                />
              </div>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  const simTime = medicalCase?.simulationTime || 0;

  return (
    <div className="min-h-screen bg-clinical-bg flex flex-col overflow-hidden text-clinical-ink">
      {!isSupabaseConfigured && (
        <div className="bg-clinical-soft border-b border-clinical-line py-1.5 px-5 flex items-center gap-2 z-50">
          <AlertTriangle className="w-3.5 h-3.5 text-clinical-amber shrink-0" />
          <span className="text-xs text-clinical-slate">History saving disabled — Supabase not configured</span>
        </div>
      )}

      {/* Case Library Modal */}
      <CaseLibrary 
        isOpen={isLibraryOpen} 
        onClose={() => setIsLibraryOpen(false)} 
        onSelectCase={(diff, cat) => loadNewCase(diff, cat)} 
      />

      <AuthModal 
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
      />

      {/* Header */}
      <header className="h-12 bg-clinical-surface border-b border-clinical-line flex items-center px-5 shrink-0 z-30">
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-clinical-blue rounded flex items-center justify-center">
                <Activity className="text-white w-3 h-3" />
              </div>
              <span className="text-sm font-semibold text-clinical-ink">OpenEHR</span>
           </div>
           <div className="h-5 w-px bg-clinical-line" />
           <div className="flex items-center gap-3 text-sm">
              <span className="font-semibold text-clinical-ink">{medicalCase?.patientName}</span>
              <span className="text-clinical-muted text-xs">#{medicalCase?.id?.slice(0,6) || '882019'}</span>
           </div>
           <div className="h-5 w-px bg-clinical-line" />
           <button 
             onClick={() => setIsLibraryOpen(true)}
             className="btn-ghost text-xs py-1 px-2"
           >
             <Clipboard className="w-3.5 h-3.5" />
             New Case
           </button>
           <span className="badge badge-muted text-[10px]">
             <div className="w-1.5 h-1.5 rounded-full bg-clinical-amber animate-pulse" />
             {medicalCase?.currentLocation || 'ER Bay 4'}
           </span>
        </div>

        <div className="ml-auto flex items-center gap-4">
          <div className="flex items-center gap-2 bg-clinical-soft rounded-md px-3 py-1.5">
            <Clock className="w-3.5 h-3.5 text-clinical-blue" />
            <span className="text-sm font-mono font-semibold text-clinical-blue">T+{simTime}m</span>
          </div>

          {user ? (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-clinical-blue rounded-full flex items-center justify-center text-[11px] font-semibold text-white">
                {user.email?.[0]?.toUpperCase()}
              </div>
              <button onClick={handleLogout} className="text-xs text-clinical-muted hover:text-clinical-red transition-colors">
                Sign out
              </button>
            </div>
          ) : (
            <button onClick={() => setIsAuthOpen(true)} className="btn-secondary text-xs py-1.5">
              <UserIcon className="w-3.5 h-3.5" />
              Sign In
            </button>
          )}

          <button onClick={() => loadNewCase()} className="p-1.5 hover:bg-clinical-soft rounded-md text-clinical-muted transition-colors" title="Generate new case">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Alarm Banner */}
      <AnimatePresence>
        {(medicalCase?.activeAlarms || []).length > 0 && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-clinical-red/5 border-b border-clinical-red/20 py-1.5 px-5 flex items-center gap-3 overflow-hidden shrink-0"
          >
            <AlertCircle className="w-4 h-4 text-clinical-red shrink-0" />
            <div className="flex gap-2 flex-wrap">
              {medicalCase?.activeAlarms.map((alarm, i) => (
                <span key={i} className="badge badge-critical text-[10px]">
                  {alarm}
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Vitals Strip */}
      <div className="h-12 bg-clinical-surface border-b border-clinical-line flex items-center px-4 gap-3 shrink-0 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-2 pr-3 border-r border-clinical-line shrink-0">
             <div className={cn(
               "dot",
               medicalCase?.physiologicalTrend === 'improving' ? "dot-success" :
               medicalCase?.physiologicalTrend === 'declining' ? "dot-warning" :
               medicalCase?.physiologicalTrend === 'critical' ? "dot-critical" : "dot-muted"
             )} />
             <span className="text-xs font-medium text-clinical-slate capitalize">{medicalCase?.physiologicalTrend}</span>
          </div>

          <div className="flex-1 max-w-[280px] h-9 shrink-0">
            <HeartMonitor 
              heartRate={medicalCase?.vitals?.heartRate || 0} 
              isAlarming={medicalCase?.activeAlarms.some(a => a.includes('HR') || a.includes('Pulse') || a.includes('Bradycardia') || a.includes('Tachycardia'))} 
            />
          </div>

          <ClinicalVital 
            label="HR" 
            value={Math.round(vitalsHistory[vitalsHistory.length - 1]?.hr || medicalCase?.vitals?.heartRate || 0)} 
            unit="BPM" 
            status="normal" 
            isAlarming={medicalCase?.activeAlarms.some(a => a.includes('HR') || a.includes('Pulse') || a.includes('Bradycardia') || a.includes('Tachycardia'))} 
            trend={vitalsHistory.map(v => v.hr)}
          />
          <ClinicalVital 
            label="BP" 
            value={medicalCase?.vitals?.bloodPressure || '--'} 
            unit="mmHg" 
            status="normal" 
            isAlarming={medicalCase?.activeAlarms.some(a => a.includes('BP') || a.includes('Pressure') || a.includes('Hypotension') || a.includes('Hypertension'))}
            trend={vitalsHistory.map(v => v.sbp)}
          />
          <ClinicalVital 
            label="RR" 
            value={medicalCase?.vitals?.respiratoryRate || '--'} 
            unit="/min" 
            status="normal" 
            isAlarming={medicalCase?.activeAlarms.some(a => a.includes('RR') || a.includes('Respiratory') || a.includes('Tachypnea') || a.includes('Apnea'))}
            trend={vitalsHistory.map(v => v.rr)}
          />
          <ClinicalVital 
            label="SpO2" 
            value={medicalCase?.vitals?.oxygenSaturation || 0} 
            unit="%" 
            status="normal" 
            isAlarming={medicalCase?.activeAlarms.some(a => a.includes('SpO2') || a.includes('Saturation') || a.includes('Hypoxia'))}
            trend={vitalsHistory.map(v => v.spo2)}
          />
          <ClinicalVital 
            label="T" 
            value={medicalCase?.vitals?.temperature || 0} 
            unit="°C" 
            status="normal" 
            isAlarming={medicalCase?.activeAlarms.some(a => a.includes('Temp') || a.includes('Temperature') || a.includes('Fever'))}
          />
          <div className="h-full w-px bg-clinical-line" />
          <div className="flex items-center gap-2 px-3 shrink-0">
             <span className="text-[10px] font-medium text-clinical-muted">NEWS2</span>
             <span className={cn(
               "text-base font-mono font-bold",
               calculateNEWS2(medicalCase?.vitals) >= 7 ? "text-clinical-red" :
               calculateNEWS2(medicalCase?.vitals) >= 5 ? "text-clinical-amber" : "text-clinical-ink"
             )}>
               {calculateNEWS2(medicalCase?.vitals)}
             </span>
          </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <nav className="w-52 bg-clinical-surface border-r border-clinical-line flex flex-col py-3 px-2 z-20 shrink-0">
           <div className="space-y-0.5">
              <NavTab active={activeTab === 'hpi'} icon={<Clipboard className="w-4 h-4" />} label="History" onClick={() => setActiveTab('hpi')} />
              <NavTab active={activeTab === 'exam'} icon={<Stethoscope className="w-4 h-4" />} label="Exam" onClick={() => setActiveTab('exam')} />
              <NavTab active={activeTab === 'labs'} icon={<FlaskConical className="w-4 h-4" />} label="Labs" onClick={() => setActiveTab('labs')} />
              <NavTab active={activeTab === 'imaging'} icon={<FileSearch className="w-4 h-4" />} label="Imaging" onClick={() => setActiveTab('imaging')} />
              <NavTab active={activeTab === 'pharmacy'} icon={<Pill className="w-4 h-4" />} label="Pharmacy" onClick={() => setActiveTab('pharmacy')} />
              <NavTab active={activeTab === 'comms'} icon={<Phone className="w-4 h-4" />} label="Comms" onClick={() => setActiveTab('comms')} />
              <NavTab active={activeTab === 'treatment'} icon={<Activity className="w-4 h-4" />} label="Interventions" onClick={() => setActiveTab('treatment')} />
              {user && (
                <NavTab active={activeTab === 'archive'} icon={<History className="w-4 h-4" />} label="Archive" onClick={() => setActiveTab('archive')} />
              )}
           </div>

           <div className="mt-auto pt-4 px-2">
              <div className="p-3 bg-clinical-soft rounded-lg">
                 <p className="label mb-1">Patient status</p>
                 <p className="text-xs text-clinical-ink leading-relaxed">
                    {medicalCase?.currentCondition}
                 </p>
              </div>
           </div>
        </nav>

        {/* Clinical Workspace */}
        <main className="flex-1 overflow-y-auto bg-clinical-bg p-6 flex flex-col gap-6">
          <AnimatePresence mode="wait">
            {activeTab === 'hpi' && (
              <motion.div key="hpi" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-clinical-surface border border-clinical-line rounded shadow-sm overflow-hidden min-h-fit">
                <div className="bg-clinical-bg p-3 border-b border-clinical-line text-[11px] font-bold text-clinical-slate uppercase">Documentation: Intake Nurse Statement</div>
                <div className="p-8 space-y-10">
                  <section>
                    <label className="text-[10px] font-bold text-clinical-slate uppercase block mb-2">Chief Complaint</label>
                    <p className="text-2xl font-serif text-clinical-ink leading-tight underline decoration-clinical-blue/20">"{medicalCase?.chiefComplaint}"</p>
                  </section>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                    <section>
                       <label className="text-[10px] font-bold text-clinical-slate uppercase block mb-3 border-b border-clinical-line pb-1">Clinical History (HPI)</label>
                       <p className="text-[13px] text-clinical-ink leading-relaxed font-medium whitespace-pre-wrap">{medicalCase?.historyOfPresentIllness}</p>
                    </section>
                    <section>
                       <label className="text-[10px] font-bold text-clinical-slate uppercase block mb-3 border-b border-clinical-line pb-1">Past Medical History</label>
                       <div className="space-y-2">
                          {(medicalCase?.pastMedicalHistory || []).map((m, i) => (
                            <div key={i} className="flex items-center gap-3 text-sm">
                               <div className="w-1.5 h-1.5 border border-clinical-slate rotate-45" />
                               {m}
                            </div>
                          ))}
                       </div>
                    </section>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'exam' && (
              <motion.div key="exam" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6">
                {/* GCS Module - Assessment Aid */}
                <div className="bg-clinical-surface border border-clinical-line rounded shadow-sm overflow-hidden">
                  <div className="bg-clinical-ink p-3 border-b border-clinical-line flex justify-between items-center">
                     <span className="text-[10px] font-bold text-white uppercase tracking-widest">Glasgow Coma Scale (GCS) Workspace</span>
                     <div className="flex items-center gap-2">
                        <span className="text-[9px] text-white/50 uppercase">Computed Score:</span>
                        <span className="text-xl font-mono font-black text-clinical-green">E{gcsState.eyes} V{gcsState.verbal} M{gcsState.motor} = {gcsState.eyes + gcsState.verbal + gcsState.motor}</span>
                     </div>
                  </div>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                     {(['eyes', 'verbal', 'motor'] as const).map(category => (
                       <div key={category} className="space-y-3">
                         <label className="text-[9px] font-bold text-clinical-slate uppercase opacity-60 tracking-widest border-b border-clinical-line w-full block pb-1">{category} Response</label>
                         <div className="flex flex-col gap-1.5">
                           {GCS_MAPPING[category].map(option => (
                             <button 
                               key={option.score}
                               onClick={() => setGcsState(prev => ({ ...prev, [category]: option.score }))}
                               className={cn(
                                 "text-left p-3 rounded text-[10px] transition-all border group",
                                 gcsState[category] === option.score 
                                   ? "bg-clinical-blue text-white border-clinical-blue font-bold shadow-md transform scale-[1.02]"
                                   : "bg-white border-clinical-line hover:border-clinical-blue/40 text-clinical-ink"
                               )}
                             >
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
                     <div className="w-2 h-2 rounded-full bg-clinical-blue animate-pulse" />
                     <span className="text-[9px] text-clinical-slate uppercase font-bold tracking-tight">Clinical Correlation Essential. "The score is a sign, not a diagnosis."</span>
                  </div>
                </div>

                <div className="bg-clinical-surface border border-clinical-line rounded shadow-sm overflow-hidden">
                  <div className="bg-clinical-bg p-3 border-b border-clinical-line text-[11px] font-bold text-clinical-slate uppercase tracking-wider">Physical Examination Findings</div>
                  <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                    {Object.entries(medicalCase?.physicalExam || {}).map(([key, val]) => (
                      <div key={key} className="space-y-1">
                        <h4 className="text-[10px] font-bold text-clinical-slate uppercase">{key}</h4>
                        <div className="p-3 bg-clinical-bg/30 border-l-2 border-clinical-line text-sm text-clinical-ink italic">
                          {val}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
            {activeTab === 'labs' && (
              <motion.div key="labs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6 h-full min-h-[500px]">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
                  <div className="lg:col-span-2 bg-clinical-surface border border-clinical-line rounded shadow-sm overflow-hidden flex flex-col">
                    <div className="bg-clinical-bg p-3 border-b border-clinical-line flex justify-between items-center">
                      <span className="text-[11px] font-bold text-clinical-slate uppercase">Clinical Chemistry & Hematology</span>
                      <span className="text-[9px] text-clinical-slate italic">Specimen: Whole Blood / Plasma</span>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      <table className="clinical-table w-full">
                        <thead className="sticky top-0 bg-white z-10">
                          <tr>
                            <th>Test</th>
                            <th>Value</th>
                            <th>Status</th>
                            <th>Reference</th>
                            <th className="w-10"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {(medicalCase?.labs || []).map((lab) => {
                            const isAvailable = lab.orderedAt !== undefined && lab.availableAt !== undefined && lab.availableAt <= simTime;
                            const isPending = lab.orderedAt !== undefined && (lab.availableAt === undefined || lab.availableAt > simTime);
                            
                            return (
                              <tr 
                                key={lab.name} 
                                onClick={() => isAvailable && setSelectedLab(lab)}
                                className={cn(
                                  "transition-colors cursor-pointer",
                                  selectedLab?.name === lab.name ? "bg-clinical-blue/5" : "hover:bg-clinical-bg/30"
                                )}
                              >
                                <td className="font-bold text-clinical-ink">{lab.name}</td>
                                <td className="font-mono text-sm px-4">
                                  {isAvailable ? (
                                    <span className={cn(
                                      lab.status === 'critical' ? 'text-clinical-red font-black' : lab.status === 'abnormal' ? 'text-clinical-amber' : ''
                                    )}>{lab.value}</span>
                                  ) : <span className="opacity-20">---</span>}
                                </td>
                                <td>
                                  {!lab.orderedAt ? (
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); handleOrderDiagnostic('lab', lab.name); }}
                                      className="text-[10px] font-bold text-clinical-blue uppercase hover:underline"
                                    >
                                      [Order Stat]
                                    </button>
                                  ) : isPending ? (
                                    <span className="text-[10px] font-bold text-clinical-amber uppercase animate-pulse">Pending...</span>
                                  ) : (
                                    <div className="flex items-center gap-1.5">
                                      <div className={cn(
                                        "w-1.5 h-1.5 rounded-full",
                                        lab.status === 'critical' ? 'bg-clinical-red' : lab.status === 'abnormal' ? 'bg-clinical-amber' : 'bg-clinical-green'
                                      )} />
                                      <span className="text-[10px] uppercase font-bold tracking-tighter opacity-60">{lab.status}</span>
                                    </div>
                                  )}
                                </td>
                                <td className="text-[11px] text-clinical-slate">{lab.normalRange} {lab.unit}</td>
                                <td>{isAvailable && <ChevronRight className="w-3 h-3 opacity-30" />}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Lab Detail / Findings */}
                  <div className="lg:col-span-1 bg-clinical-surface border border-clinical-line rounded shadow-sm flex flex-col overflow-hidden">
                    <div className="bg-clinical-bg p-3 border-b border-clinical-line">
                      <span className="text-[10px] font-bold text-clinical-slate uppercase tracking-widest">Result Interpretations</span>
                    </div>
                    <div className="flex-1 p-6 overflow-y-auto">
                      {selectedLab ? (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                           <div>
                             <h4 className="text-[10px] font-bold text-clinical-slate uppercase tracking-widest mb-1">Component</h4>
                             <p className="text-lg font-bold">{selectedLab.name}</p>
                           </div>
                           
                           <div className="grid grid-cols-2 gap-4">
                             <div className="bg-clinical-bg p-3 rounded">
                               <h5 className="text-[9px] font-bold text-clinical-slate uppercase mb-1">Current</h5>
                               <p className="font-mono text-xl font-bold">{selectedLab.value}</p>
                             </div>
                             <div className="bg-clinical-bg p-3 rounded">
                               <h5 className="text-[9px] font-bold text-clinical-slate uppercase mb-1">Status</h5>
                               <p className={cn(
                                 "text-[11px] font-bold uppercase",
                                 selectedLab.status === 'critical' ? "text-clinical-red" : selectedLab.status === 'abnormal' ? "text-clinical-amber" : "text-clinical-green"
                               )}>{selectedLab.status}</p>
                             </div>
                           </div>

                           <div>
                             <h4 className="text-[10px] font-bold text-clinical-slate uppercase tracking-widest mb-3 border-b border-clinical-line pb-1">Pathologist / Tech Comments</h4>
                             <p className="text-xs text-clinical-ink italic leading-relaxed border-l-2 border-clinical-blue/20 pl-4">
                               {selectedLab.clinicalNote || "No morphological abnormalities noted on microscopic review. Validated by automated hematology analyzer."}
                             </p>
                           </div>

                           <div className="pt-4 space-y-2">
                             <div className="flex justify-between text-[10px]">
                               <span className="text-clinical-slate uppercase font-bold">Ordered:</span>
                               <span className="font-mono">T + {selectedLab.orderedAt}m</span>
                             </div>
                             <div className="flex justify-between text-[10px]">
                               <span className="text-clinical-slate uppercase font-bold">Verified:</span>
                               <span className="font-mono text-clinical-green font-bold">T + {selectedLab.availableAt}m</span>
                             </div>
                           </div>
                        </div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-clinical-slate/40 text-center italic">
                          <FlaskConical className="w-12 h-12 mb-4 opacity-20" />
                          <p className="text-[10px] uppercase font-bold tracking-widest">Select Lab Row</p>
                          <p className="text-[9px] mt-2">Click on a test to view professional interpretation and comments.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}


            {activeTab === 'imaging' && (
              <motion.div key="imaging" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6 h-full min-h-[500px]">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
                  {/* PACS List */}
                  <div className="lg:col-span-1 bg-clinical-surface border border-clinical-line rounded flex flex-col overflow-hidden max-h-[600px]">
                    <div className="bg-clinical-bg p-3 border-b border-clinical-line flex items-center justify-between">
                      <span className="text-[10px] font-bold text-clinical-slate uppercase tracking-widest">Imaging Worklist</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                       {medicalCase?.imaging.map((img, i) => {
                         const isAvailable = img.orderedAt !== undefined && img.availableAt !== undefined && img.availableAt <= simTime;
                         const isPending = img.orderedAt !== undefined && (img.availableAt === undefined || img.availableAt > simTime);
                         return (
                           <button 
                             key={i}
                             onClick={() => isAvailable && setRevealedLabs(prev => [...prev, img.type])}
                             className={cn(
                               "w-full text-left p-3 rounded border transition-all flex flex-col gap-1",
                               revealedLabs.includes(img.type) ? "bg-clinical-blue text-white border-clinical-blue" : "bg-white border-clinical-line hover:border-clinical-blue",
                               isPending && "bg-clinical-bg opacity-70 cursor-wait",
                               !img.orderedAt && "opacity-50"
                             )}
                           >
                              <div className="flex justify-between items-center">
                                <span className="text-[11px] font-bold uppercase">{img.type}</span>
                                {isAvailable ? (
                                  <div className="w-1.5 h-1.5 bg-clinical-green rounded-full" />
                                ) : isPending ? (
                                  <Clock className="w-3 h-3 animate-spin text-clinical-amber" />
                                ) : (
                                  <div className="w-1.5 h-1.5 bg-clinical-slate rounded-full opacity-30" />
                                )}
                              </div>
                              <div className="text-[9px] opacity-70 flex justify-between">
                                <span>{isAvailable ? "COMPLETED" : isPending ? "PENDING..." : "UNORDERED"}</span>
                                {img.orderedAt && <span>T + {img.orderedAt}m</span>}
                              </div>
                              {!img.orderedAt && (
                                <span onClick={(e) => { e.stopPropagation(); handleOrderDiagnostic('imaging', img.type); }} className="mt-2 text-[9px] text-clinical-blue font-bold uppercase hover:underline">
                                  Place Stat Order
                                </span>
                              )}
                           </button>
                         );
                       })}
                    </div>
                  </div>

                  {/* Radiology Report Viewer */}
                  <div className="lg:col-span-2 bg-[#0f1115] border border-clinical-line rounded flex flex-col overflow-hidden text-[#d1d5db]">
                    <div className="bg-[#1a1c23] p-2 border-b border-[#2d3139] flex items-center justify-between px-4">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#6b7280]">DICOM Viewer v4.2 - Clinical Station</span>
                      <div className="flex gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-[#f87171] opacity-50" />
                        <div className="w-2 h-2 rounded-full bg-[#fbbf24] opacity-50" />
                        <div className="w-2 h-2 rounded-full bg-[#34d399] opacity-50" />
                      </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-8 space-y-6">
                      {medicalCase?.imaging.find(img => revealedLabs.includes(img.type)) ? (
                        (() => {
                           const img = medicalCase.imaging.find(img => revealedLabs.includes(img.type))!;
                           return (
                             <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                               <div className="border-b border-[#2d3139] pb-4 flex justify-between items-end">
                                 <div>
                                   <h1 className="text-xl font-bold tracking-tight uppercase text-white">{img.type}</h1>
                                   <p className="text-[10px] text-[#9ca3af]">TECHNIQUE: {img.technique || 'Standard CT protocol with IV contrast'}</p>
                                 </div>
                                 <div className="text-right">
                                   <p className="text-[10px] font-mono text-[#4b5563]">ACCESSION: #{medicalCase.id.slice(0,6).toUpperCase()}</p>
                                   <p className="text-[10px] font-mono text-[#4b5563]">STAMP: T + {img.availableAt}m</p>
                                 </div>
                               </div>

                               <div className="space-y-6">
                                 <section>
                                   <h2 className="text-[9px] font-bold text-clinical-blue uppercase tracking-widest mb-3 border-b border-clinical-blue/20 pb-1">Clinical Findings</h2>
                                   <p className="text-sm border-l-2 border-[#2d3139] pl-6 leading-relaxed text-[#9ca3af] whitespace-pre-line font-serif italic">
                                      {img.findings || "Reviewing voxel data sequences..."}
                                   </p>
                                 </section>

                                 <section className="bg-[#161a22] p-5 rounded-lg border border-clinical-blue/20 shadow-inner">
                                   <h2 className="text-[9px] font-bold text-clinical-red uppercase tracking-widest mb-3">Diagnostic Impression</h2>
                                   <p className="text-sm font-bold text-white">
                                      {img.impression || "Final report pending clinician signature."}
                                   </p>
                                 </section>
                               </div>

                               <div className="pt-12 border-t border-[#2d3139] flex justify-between items-center opacity-20 filter grayscale">
                                 <div className="text-[8px] uppercase">Digitally Verified: RAD_SYSTEM_8.0</div>
                                 <div className="text-[8px] uppercase font-mono tracking-tighter">SECURE RECORD // DO NOT DISTRIBUTE</div>
                               </div>
                             </div>
                           );
                        })()
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-[#374151] text-center italic">
                          <FileSearch className="w-16 h-16 mb-4 opacity-10" />
                          <p className="text-[11px] font-bold uppercase tracking-widest opacity-40">Awaiting Image Selection</p>
                          <p className="text-[10px] mt-2 opacity-30 max-w-[180px]">Select a completed diagnostic study from the side worklist to review findings.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'pharmacy' && (
              <motion.div key="pharmacy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6 h-full">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
                  {/* Pharmacy Catalog */}
                  <div className="bg-clinical-surface border border-clinical-line rounded p-6 shadow-sm">
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
                          <div className="grid grid-cols-1 gap-2">
                            {group.meds.map(med => (
                              <button 
                                key={med}
                                onClick={() => handlePerformIntervention(2, `Administer ${med}`)}
                                disabled={intervening}
                                className="flex justify-between items-center p-3 bg-white border border-clinical-line rounded hover:border-clinical-blue hover:bg-clinical-blue/5 transition-all text-xs font-medium"
                              >
                                <span>{med}</span>
                                <Plus className="w-3 h-3 text-clinical-blue" />
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Active Admin Record */}
                  <div className="bg-clinical-surface border border-clinical-line rounded p-6 shadow-sm flex flex-col">
                    <h4 className="text-[10px] font-bold text-clinical-slate uppercase tracking-widest mb-4">Current Order Workflow</h4>
                    <div className="flex-1 flex flex-col items-center justify-center p-8 border-2 border-dashed border-clinical-line rounded opacity-40 text-center">
                      <Pill className="w-12 h-12 mb-4" />
                      <p className="text-xs font-bold uppercase mb-2">Custom Pharmacy Order</p>
                      <div className="w-full flex gap-2">
                        <input 
                          type="text" 
                          value={customMedInput}
                          onChange={(e) => setCustomMedInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && customMedInput) {
                              handlePerformIntervention(2, `Administer ${customMedInput}`);
                              setCustomMedInput('');
                            }
                          }}
                          placeholder="Drug Name (e.g. Norepinephrine)" 
                          className="flex-1 bg-white border border-clinical-line rounded p-2 text-xs focus:outline-none focus:border-clinical-blue"
                        />
                        <button 
                          onClick={() => {
                            if (customMedInput) {
                              handlePerformIntervention(2, `Administer ${customMedInput}`);
                              setCustomMedInput('');
                            }
                          }}
                          className="bg-clinical-blue text-white px-4 py-2 rounded text-[10px] font-bold uppercase"
                        >
                          GiveStat
                        </button>
                      </div>
                      <p className="text-[9px] mt-4 max-w-[200px]">Instructions: Select a preset medication or enter a custom drug and dose for immediate nursing administration.</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'comms' && (
              <motion.div key="comms" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6 h-full">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0">
                  <div className="md:col-span-1 bg-clinical-surface border border-clinical-line rounded p-4 flex flex-col gap-4">
                    <h3 className="text-[10px] font-bold text-clinical-slate uppercase tracking-widest border-b border-clinical-line pb-2">Hospital Directory</h3>
                    <div className="space-y-1 overflow-y-auto max-h-[200px] pr-2">
                      {STAFF_TARGETS.map(target => (
                        <button 
                          key={target}
                          onClick={() => setCallTarget(target)}
                          className={cn(
                            "w-full text-left px-3 py-2 rounded text-xs transition-colors flex items-center justify-between",
                            callTarget === target ? "bg-clinical-blue text-white font-bold" : "text-clinical-slate hover:bg-clinical-bg"
                          )}
                        >
                          {target}
                          {callTarget === target && <Phone className="w-3 h-3" />}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="md:col-span-2 bg-clinical-surface border border-clinical-line rounded p-4 flex flex-col gap-4">
                    <h3 className="text-[10px] font-bold text-clinical-slate uppercase tracking-widest border-b border-clinical-line pb-2">Initiate Call: {callTarget}</h3>
                    <div className="flex gap-4">
                      <input 
                        type="text" 
                        value={callMessage}
                        onChange={(e) => setCallMessage(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleStaffCall()}
                        placeholder={`Message for ${callTarget}...`}
                        className="flex-1 bg-clinical-bg border border-clinical-line rounded px-4 py-3 text-sm focus:outline-none focus:border-clinical-blue transition-all"
                      />
                      <button 
                        onClick={handleStaffCall}
                        disabled={calling || !callMessage}
                        className="px-6 bg-clinical-blue text-white rounded font-bold uppercase text-[11px] tracking-widest hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center gap-2"
                      >
                        {calling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Send
                      </button>
                    </div>
                    <p className="text-[10px] text-clinical-slate italic">Note: Formal documentation will be added to patient EHR record automatically.</p>
                  </div>
                </div>

                <div className="flex-1 bg-clinical-surface border border-clinical-line rounded shadow-sm flex flex-col overflow-hidden min-h-[300px]">
                  <div className="bg-clinical-bg p-3 border-b border-clinical-line flex items-center justify-between">
                    <span className="text-[11px] font-bold text-clinical-slate uppercase">Interaction History</span>
                    <span className="text-[10px] text-clinical-slate italic select-none">Secure Communication Line 582</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#f8f9fa]">
                    {(medicalCase?.communicationLog || []).length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center opacity-20 italic">
                        <MessageSquare className="w-12 h-12 mb-4" />
                        <p className="text-xs">No current active threads</p>
                      </div>
                    ) : (
                      medicalCase.communicationLog.map((msg, i) => (
                        <div key={i} className={cn(
                          "max-w-[80%] flex flex-col gap-1",
                          msg.from === 'You' || msg.from === 'Physician' ? "ml-auto items-end" : "mr-auto items-start"
                        )}>
                          <div className="text-[9px] font-bold text-clinical-slate uppercase px-1">{msg.from} → {msg.to}</div>
                          <div className={cn(
                            "p-3 rounded-lg text-sm shadow-sm",
                            msg.from === 'You' || msg.from === 'Physician' 
                              ? "bg-clinical-blue text-white rounded-tr-none" 
                              : "bg-white border border-clinical-line rounded-tl-none text-clinical-ink"
                          )}>
                            {msg.message}
                          </div>
                          <div className="text-[9px] text-clinical-slate font-mono px-1">T + {msg.timestamp} min</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'treatment' && (
               <motion.div key="treatment" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-6">
                     <div className="bg-clinical-surface border border-clinical-line rounded p-6 shadow-sm">
                        <label className="text-[10px] font-bold text-clinical-slate uppercase block mb-3 tracking-widest">Electronic Order Entry (CPOE)</label>
                        <textarea 
                          value={interventionInput}
                          onChange={(e) => setInterventionInput(e.target.value)}
                          placeholder="Select med, dose, route, and frequency..."
                          className="w-full h-32 bg-clinical-bg border border-clinical-line rounded p-4 text-sm font-medium focus:outline-none focus:border-clinical-blue transition-all resize-none"
                        />
                        <div className="mt-4 flex gap-3">
                           <button 
                             onClick={() => handlePerformIntervention()} 
                             disabled={intervening || !interventionInput}
                             className="flex-1 py-3 bg-clinical-ink text-white rounded font-bold text-[11px] uppercase tracking-widest hover:bg-clinical-slate transition-all disabled:opacity-30"
                           >
                             Execute Order
                           </button>
                           <button 
                             onClick={() => handlePerformIntervention(10)} 
                             disabled={intervening}
                             className="px-6 border border-clinical-line text-clinical-slate rounded font-bold text-[11px] uppercase hover:bg-clinical-bg transition-all"
                           >
                             Wait 10m
                           </button>
                        </div>
                     </div>

                     <div className="bg-clinical-surface border border-clinical-line rounded p-6 shadow-sm">
                        <label className="text-[10px] font-bold text-clinical-slate uppercase block mb-3 tracking-widest">Assessment & Plan (Soap Note)</label>
                        <textarea 
                          placeholder="Enter clinical reasoning and long-term diagnostic plan..."
                          className="w-full h-24 bg-clinical-bg border border-clinical-line rounded p-4 text-xs font-serif italic focus:outline-none focus:border-clinical-blue transition-all resize-none shadow-inner"
                        />
                        <p className="text-[9px] text-clinical-slate mt-2 opacity-60">This section is for personal clinical documentation and does not trigger simulation changes.</p>
                     </div>

                     <div className="bg-clinical-surface border border-clinical-line rounded p-6 shadow-sm">
                        <label className="text-[10px] font-bold text-clinical-slate uppercase block mb-3 tracking-widest">Medication Administration Record (MAR)</label>
                        <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2">
                          {(medicalCase?.medications || []).length === 0 ? (
                            <div className="py-8 text-center text-[10px] text-clinical-slate uppercase italic opacity-40 border border-dashed border-clinical-line rounded">
                              No Meds Administered
                            </div>
                          ) : (
                            medicalCase?.medications.map((med, i) => (
                              <div key={i} className="flex items-center justify-between p-3 bg-clinical-bg border border-clinical-line rounded text-xs">
                                <div className="flex items-center gap-3">
                                  <div className="w-2 h-2 bg-clinical-blue rounded-full" />
                                  <span className="font-bold">{med.name}</span>
                                  <span className="opacity-60">{med.dose || '-'} {med.route ? `via ${med.route}` : ''}</span>
                                </div>
                                <span className="font-mono text-[9px] text-clinical-slate underline">T + {med.timestamp}m</span>
                              </div>
                            ))
                          )}
                        </div>
                     </div>

                      <div className="bg-clinical-surface border border-clinical-line rounded p-6 shadow-sm">
                        <label className="text-[10px] font-bold text-clinical-slate uppercase block mb-3 tracking-widest">Rapid Transfer / Admission</label>
                        <div className="grid grid-cols-2 gap-3 pb-6 border-b border-clinical-line mb-6">
                           {['Intensive Care (ICU)', 'OR / Surgery', 'Cardiac Cath Lab', 'General Ward', 'Radiology (CT/MRI)'].map(dept => (
                             <button 
                               key={dept}
                               onClick={() => handlePerformIntervention(0, `Transfer to ${dept}`)}
                               disabled={intervening}
                               className="py-2 px-3 border border-clinical-line rounded text-[10px] font-bold text-clinical-slate uppercase hover:bg-clinical-blue hover:text-white hover:border-clinical-blue transition-all flex items-center gap-2"
                             >
                               <UserPlus className="w-3 h-3" />
                               {dept}
                             </button>
                           ))}
                        </div>

                        <label className="text-[10px] font-bold text-clinical-slate uppercase block mb-3 tracking-widest">Simulation Timeline</label>
                        <div className="grid grid-cols-2 gap-3">
                           <button 
                             onClick={() => handlePerformIntervention(15, 'Observe patient')}
                             disabled={intervening}
                             className="py-2 px-3 border border-clinical-line rounded text-[10px] font-bold text-clinical-slate uppercase hover:bg-clinical-ink hover:text-white transition-all flex items-center justify-center gap-2"
                           >
                             <Clock className="w-3 h-3" />
                             Wait 15m
                           </button>
                           <button 
                             onClick={() => handlePerformIntervention(60, 'Periodic monitoring')}
                             disabled={intervening}
                             className="py-2 px-3 border border-clinical-line rounded text-[10px] font-bold text-clinical-slate uppercase hover:bg-clinical-ink hover:text-white transition-all flex items-center justify-center gap-2"
                           >
                             <Clock className="w-3 h-3" />
                             Wait 1h
                           </button>
                        </div>
                     </div>

                     <div className="bg-clinical-ink text-clinical-green p-6 rounded shadow-lg font-mono">
                        <div className="flex justify-between items-center mb-4 border-b border-clinical-green/20 pb-2">
                           <span className="text-[10px] uppercase font-bold tracking-widest">Vital Stream</span>
                           <div className="w-2 h-2 rounded-full bg-clinical-green animate-pulse" />
                        </div>
                        <div className="h-40">
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
                      {/* Fluid Balance Monitor */}
                      <div className="bg-clinical-surface border border-clinical-line rounded shadow-sm overflow-hidden flex flex-col">
                        <div className="bg-clinical-bg p-3 border-b border-clinical-line flex justify-between items-center">
                           <span className="text-[10px] font-bold text-clinical-slate uppercase tracking-widest">Fluid Balance & I/O</span>
                           <div className="flex items-center gap-1">
                              <span className="text-[9px] text-clinical-slate uppercase">Net:</span>
                              <span className={cn(
                                "text-xs font-mono font-bold",
                                (medicalCase?.medications.length || 0) * 200 > 500 ? "text-clinical-blue" : "text-clinical-ink"
                              )}>+{(medicalCase?.medications.length || 0) * 200} mL</span>
                           </div>
                        </div>
                        <div className="p-6 flex-1 flex flex-col gap-6">
                            <div className="flex justify-between items-end gap-2 h-24">
                               <div className="flex-1 bg-clinical-bg border border-clinical-line rounded-t relative overflow-hidden group">
                                  <div className="absolute bottom-0 left-0 right-0 bg-clinical-blue/20 transition-all duration-1000" style={{ height: `${Math.min(100, (medicalCase?.medications.length || 0) * 10 + 20)}%` }} />
                                  <div className="absolute inset-0 flex items-center justify-center text-[7px] font-bold text-clinical-slate uppercase tracking-tighter z-10 text-center px-1">Total Intake</div>
                               </div>
                               <div className="flex-1 bg-clinical-bg border border-clinical-line rounded-t relative overflow-hidden group">
                                  <div className="absolute bottom-0 left-0 right-0 bg-clinical-amber/20 transition-all duration-1000" style={{ height: '35%' }} />
                                  <div className="absolute inset-0 flex items-center justify-center text-[7px] font-bold text-clinical-slate uppercase tracking-tighter z-10 text-center px-1">Urine Output</div>
                               </div>
                            </div>
                            <div className="space-y-2 pt-2">
                               <div className="flex justify-between text-[10px]">
                                  <span className="text-clinical-slate font-bold uppercase opacity-60">Maintenance Fluids:</span>
                                  <span className="font-mono">NS @ 80 mL/hr</span>
                               </div>
                               <div className="flex justify-between text-[10px]">
                                  <span className="text-clinical-slate font-bold uppercase opacity-60">Stat Boluses:</span>
                                  <span className="font-mono text-clinical-blue">+{(medicalCase?.medications.filter(m => m.name.includes('Bolus') || m.name.includes('NS') || m.name.includes('LR')).length || 0) * 500} mL</span>
                               </div>
                            </div>
                        </div>
                      </div>

                      <div className="bg-clinical-surface border border-clinical-line rounded shadow-sm flex flex-col h-[400px]">
                          <div className="bg-clinical-bg p-3 border-b border-clinical-line text-[11px] font-bold text-clinical-slate uppercase">Intervention Chronology</div>
                          <div className="flex-1 overflow-y-auto p-4 space-y-4">
                             {(medicalCase?.clinicalActions || []).length === 0 ? (
                               <div className="h-full flex flex-col items-center justify-center opacity-20 italic">
                                 <History className="w-12 h-12 mb-4" />
                                 <p className="text-xs">Timeline Empty</p>
                               </div>
                             ) : (
                               (medicalCase?.clinicalActions || []).map((a, i) => (
                                 <div key={i} className="flex gap-4 group">
                                    <div className="text-[10px] font-mono text-clinical-slate w-12 pt-1 border-r border-clinical-line shrink-0">T+{a.timestamp}</div>
                                    <div className="flex-1 pb-4">
                                       <p className="text-xs font-bold text-clinical-ink leading-tight mb-1">{a.description}</p>
                                       <p className="text-[11px] text-clinical-slate border-l-2 border-clinical-blue/30 pl-4 py-1 italic text-[10px]">
                                         {a.impact || a.result}
                                       </p>
                                    </div>
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
                    <span className="text-[9px] text-clinical-slate uppercase font-bold opacity-60">Verified Records for {user?.email || 'Unauthorized'}</span>
                  </div>
                  <div className="p-0">
                    <ArchiveView user={user} />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Diagnostic Console - Bottom Persistent */}
          <footer className="mt-auto bg-clinical-surface border border-clinical-line rounded p-6 shadow-md shrink-0">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-[11px] font-bold text-clinical-slate uppercase tracking-widest flex items-center gap-2">
                  <Stethoscope className="w-3 h-3" />
                  Attending's Assessment & Plan
                </h3>
                {feedback && <div className="px-3 py-1 bg-clinical-blue text-white rounded text-[10px] font-bold">CASE TERMINATED</div>}
             </div>
             
             {!feedback && (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
                 <div>
                    <label className="text-[9px] font-bold text-clinical-slate uppercase mb-2 block">Working Differential</label>
                    <textarea 
                      placeholder="1. Septic Shock&#10;2. Pulmonary Embolism&#10;3. Hypovolemic Shock"
                      className="w-full h-20 bg-clinical-bg border border-clinical-line rounded p-4 text-xs font-mono focus:outline-none focus:border-clinical-blue transition-all resize-none shadow-inner"
                    />
                 </div>
                 <div>
                    <label className="text-[9px] font-bold text-clinical-slate uppercase mb-2 block">Confirmatory Findings</label>
                    <div className="flex flex-wrap gap-2">
                       {medicalCase?.labs.filter(l => l.status === 'critical').map(l => (
                         <span key={l.name} className="px-2 py-1 bg-clinical-red/10 text-clinical-red text-[9px] font-bold rounded flex items-center gap-1">
                           <AlertTriangle className="w-2 h-2" /> {l.name}: {l.value}
                         </span>
                       ))}
                       {medicalCase?.imaging.filter(i => i.availableAt && i.availableAt <= simTime).map(i => (
                         <span key={i.type} className="px-2 py-1 bg-clinical-blue/10 text-clinical-blue text-[9px] font-bold rounded">
                           {i.type} (+)
                         </span>
                       ))}
                    </div>
                 </div>
               </div>
             )}

             {feedback ? (
               <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex gap-8 items-start">
                    <div className="w-20 h-20 rounded-full border-4 border-clinical-bg flex items-center justify-center relative shrink-0">
                        <svg className="absolute inset-0 w-full h-full -rotate-90">
                          <circle cx="40" cy="40" r="36" fill="none" stroke="#EDF2F7" strokeWidth="4" />
                          <circle cx="40" cy="40" r="36" fill="none" stroke="#2B6CB0" strokeWidth="4" strokeDasharray={`${feedback.score * 2.26} 226`} />
                        </svg>
                        <span className="text-xl font-black text-clinical-ink">{feedback.score}</span>
                    </div>
                    <div className="flex-1">
                        <h4 className="text-xs font-black text-clinical-blue uppercase tracking-widest mb-2">Simulation Outcome: {feedback.score >= 80 ? 'Success' : 'Review Required'}</h4>
                        <div className="bg-clinical-bg p-4 rounded-lg border border-clinical-line border-l-4 border-l-clinical-blue mb-4">
                          <p className="text-[11px] leading-relaxed text-clinical-ink italic whitespace-pre-wrap">"{feedback.feedback}"</p>
                        </div>
                        <p className="text-[10px] text-clinical-slate uppercase font-bold">Standard of Care Diagnosis: <span className="text-clinical-ink ml-1">{medicalCase?.correctDiagnosis}</span></p>
                    </div>
                  </div>
                  
                  <div className="border-t border-clinical-line pt-6">
                    <h5 className="text-[9px] font-black text-clinical-slate uppercase tracking-widest mb-4">Clinical Action Audit</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                      {medicalCase?.clinicalActions.map((action, i) => (
                        <div key={i} className="flex gap-3 text-[10px] bg-white p-2 rounded border border-clinical-line shadow-sm">
                          <span className="font-mono text-clinical-blue font-bold">T+{action.timestamp}</span>
                          <span className="text-clinical-ink leading-tight">{action.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-center pt-2">
                    <button onClick={() => loadNewCase()} className="px-10 py-3 bg-clinical-blue text-white rounded font-bold uppercase text-[10px] tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-clinical-blue/20">
                      Admit Next Patient
                    </button>
                  </div>
               </div>
             ) : (
               <div className="flex gap-4">
                  <textarea 
                    value={userDiagnosis}
                    onChange={(e) => setUserDiagnosis(e.target.value)}
                    placeholder="Enter final working diagnosis and disposition plan..."
                    className="flex-1 h-20 bg-clinical-bg border border-clinical-line rounded p-4 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-clinical-blue transition-all"
                  />
                  <button 
                    onClick={handleSubmitDiagnosis}
                    disabled={submitting || !userDiagnosis}
                    className="h-20 px-8 bg-clinical-blue hover:bg-blue-700 text-white rounded flex flex-col items-center justify-center gap-1 transition-all disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Commit</span>
                  </button>
               </div>
             )}
          </footer>
        </main>
      </div>
    </div>
  );
}

function HeartMonitor({ heartRate, isAlarming }: { heartRate: number, isAlarming?: boolean }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let x = 0;
    const height = canvas.height;
    const width = canvas.width;
    
    // Beat timing: 60/HR seconds per beat
    // At 60 FPS, that's 60 / (HR/60) frames per beat = 3600 / HR frames
    const framesPerBeat = 3600 / (heartRate || 60);
    let frameCount = 0;

    const render = () => {
      // Clear a small slice ahead of the current position to create the "moving" effect
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(x, 0, 15, height);
      
      ctx.strokeStyle = isAlarming ? '#ef4444' : '#22c55e';
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 4;
      ctx.shadowColor = isAlarming ? '#ef4444' : '#22c55e';
      
      ctx.beginPath();
      ctx.moveTo(x, height / 2);

      const t = frameCount % Math.floor(framesPerBeat);
      let yOffset = 0;

      // P wave
      if (t > 10 && t < 25) {
        yOffset = Math.sin((t - 10) * Math.PI / 15) * -4;
      }
      // QRS complex
      else if (t >= 25 && t < 28) {
        yOffset = (t - 25) * 4; // Q
      }
      else if (t >= 28 && t < 32) {
        yOffset = -25 + (t - 28) * 0; // R peak
        yOffset = -25;
      }
      else if (t >= 32 && t < 35) {
        yOffset = (t - 32) * 5; // S
      }
      // T wave
      else if (t > 50 && t < 75) {
        yOffset = Math.sin((t - 50) * Math.PI / 25) * -6;
      }

      ctx.lineTo(x + 1, height / 2 + yOffset);
      ctx.stroke();

      x = (x + 1) % width;
      frameCount++;
      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [heartRate, isAlarming]);

  return (
    <div className="relative bg-[#0a0a0a] border border-white/10 rounded flex-1 h-full flex items-center overflow-hidden">
      <div className="absolute top-1 left-2 text-[7px] font-bold text-[#22c55e] uppercase tracking-widest opacity-40 z-10">Lead II - Realtime</div>
      <canvas ref={canvasRef} width={400} height={64} className="w-full h-full" />
    </div>
  );
}

function Sparkline({ data, color }: { data: number[], color: string }) {
  if (data.length < 2) return <div className="w-12 h-4 opacity-10 bg-clinical-slate/20 rounded" />;
  
  const min = Math.min(...data) * 0.9;
  const max = Math.max(...data) * 1.1;
  const range = max - min || 1;
  const width = 60;
  const height = 16;
  
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((d - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

function ClinicalVital({ label, value, unit, status, isAlarming, trend }: { label: string, value: string | number, unit: string, status: 'normal' | 'abnormal' | 'critical', isAlarming?: boolean, trend?: number[] }) {
  return (
    <div className={cn("flex items-center gap-3 px-3 py-1 shrink-0 rounded-md transition-all", isAlarming && "bg-clinical-red/5 border border-clinical-red/20")}>
      <div className="flex flex-col">
        <span className="text-[10px] font-medium text-clinical-muted">{label}</span>
        <div className="flex items-baseline gap-1">
          <span className={cn(
            "text-lg font-mono font-semibold leading-none",
            isAlarming || status === 'critical' ? 'text-clinical-red' : status === 'abnormal' ? 'text-clinical-amber' : 'text-clinical-ink'
          )}>{value}</span>
          <span className="text-[10px] text-clinical-muted">{unit}</span>
        </div>
      </div>
      {trend && <Sparkline data={trend} color={isAlarming || status === 'critical' ? '#DC2626' : status === 'abnormal' ? '#D97706' : '#2563EB'} />}
    </div>
  );
}

function NavTab({ active, icon, label, onClick }: { active: boolean, icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2 rounded-md transition-all text-[13px] font-medium",
        active 
          ? "bg-clinical-blue text-white shadow-sm" 
          : "text-clinical-slate hover:bg-clinical-soft hover:text-clinical-ink"
      )}
    >
      <div className={cn("transition-colors", active ? "text-white" : "text-clinical-muted")}>
        {icon}
      </div>
      <span>{label}</span>
    </button>
  );
}

interface CaseLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCase: (difficulty: string, category: string) => void;
}

function CaseLibrary({ isOpen, onClose, onSelectCase }: CaseLibraryProps) {
  const [recentCases, setRecentCases] = useState<any[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoadingRecent(true);
      getRecentSimulations()
        .then(setRecentCases)
        .finally(() => setLoadingRecent(false));
    }
  }, [isOpen]);

  const categories = [
    { id: 'cardiology', label: 'Cardiology', icon: <Heart className="w-4 h-4" /> },
    { id: 'pulmonology', label: 'Pulmonology', icon: <Wind className="w-4 h-4" /> },
    { id: 'sepsis', label: 'Sepsis/Shock', icon: <AlertTriangle className="w-4 h-4" /> },
    { id: 'trauma', label: 'Trauma/surgical', icon: <Droplets className="w-4 h-4" /> },
    { id: 'neurology', label: 'Neurology', icon: <Activity className="w-4 h-4" /> },
    { id: 'toxicology', label: 'Toxicology', icon: <FlaskConical className="w-4 h-4" /> },
  ];

  const difficulties = [
    { id: 'intern', label: 'Intern', desc: 'Clear clinical signs, classic presentations.' },
    { id: 'resident', label: 'Resident', desc: 'Mixed clues, requires differential thinking.' },
    { id: 'attending', label: 'Attending', desc: 'Subtle clues, complex co-morbidities.' },
  ];

  const [selectedDifficulty, setSelectedDifficulty] = useState('resident');

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-clinical-ink/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl bg-white rounded-lg shadow-2xl z-[101] overflow-hidden"
          >
            <div className="bg-clinical-surface border-b border-clinical-line p-6 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-clinical-ink">Clinical Case Library</h2>
                <p className="text-xs text-clinical-slate uppercase tracking-widest font-medium mt-1">Select simulation parameters for real-time generation</p>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-clinical-bg rounded-lg transition-colors text-clinical-slate"
              >
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3">
              {/* Difficulty Selection */}
              <div className="p-6 border-r border-clinical-line bg-clinical-bg/30">
                <h3 className="text-[10px] font-bold text-clinical-slate uppercase tracking-widest mb-6 border-b border-clinical-line pb-1">Select Difficulty Level</h3>
                <div className="space-y-3">
                  {difficulties.map(d => (
                    <button
                      key={d.id}
                      onClick={() => setSelectedDifficulty(d.id)}
                      className={cn(
                        "w-full text-left p-4 rounded-lg border transition-all",
                        selectedDifficulty === d.id 
                          ? "bg-clinical-blue text-white border-clinical-blue shadow-lg scale-[1.02]" 
                          : "bg-white border-clinical-line hover:border-clinical-blue/40 text-clinical-ink"
                      )}
                    >
                      <div className="font-bold text-xs uppercase tracking-wider mb-1">{d.label}</div>
                      <div className={cn("text-[10px] leading-tight opacity-70", selectedDifficulty === d.id ? "text-white/80" : "text-clinical-slate")}>{d.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Category Collection */}
              <div className="md:col-span-2 p-6">
                <h3 className="text-[10px] font-bold text-clinical-slate uppercase tracking-widest mb-6 border-b border-clinical-line pb-1">Choose Clinical Pathway</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {categories.map(c => (
                    <button
                      key={c.id}
                      onClick={() => onSelectCase(selectedDifficulty, c.id)}
                      className="group p-6 rounded-xl border border-clinical-line hover:border-clinical-blue hover:shadow-xl hover:-translate-y-1 transition-all text-left bg-clinical-surface relative overflow-hidden"
                    >
                      <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity scale-[4]">
                        {c.icon}
                      </div>
                      <div className="w-10 h-10 rounded-lg bg-clinical-bg border border-clinical-line flex items-center justify-center text-clinical-blue mb-4 group-hover:bg-clinical-blue group-hover:text-white transition-colors">
                        {c.icon}
                      </div>
                      <div className="font-bold text-clinical-ink group-hover:text-clinical-blue transition-colors">{c.label}</div>
                      <p className="text-[10px] text-clinical-slate mt-1 uppercase tracking-tighter opacity-60">Generate Fresh Scenario</p>
                    </button>
                  ))}

                  <button
                    onClick={() => onSelectCase(selectedDifficulty, 'any')}
                    className="md:col-span-2 p-6 rounded-xl border-2 border-dashed border-clinical-blue/30 hover:border-clinical-blue hover:bg-clinical-blue/5 transition-all text-center group"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCw className="w-6 h-6 text-clinical-blue group-hover:rotate-180 transition-transform duration-700" />
                      <div className="font-bold text-clinical-blue uppercase tracking-widest text-sm">Random Emergency Scenario</div>
                      <p className="text-[10px] text-clinical-slate uppercase tracking-tighter opacity-60 italic">Surprise diagnosis based on full clinical pool</p>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-clinical-bg p-4 border-t border-clinical-line">
              <h3 className="text-[10px] font-bold text-clinical-slate uppercase tracking-widest mb-3 border-b border-clinical-line pb-1">Recent Clinical Records</h3>
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                {loadingRecent ? (
                  <div className="flex items-center gap-2 text-[10px] text-clinical-slate uppercase py-2">
                    <Loader2 className="w-3 h-3 animate-spin" /> Fetching history...
                  </div>
                ) : recentCases.length > 0 ? (
                  recentCases.map((rc, i) => (
                    <div key={i} className="min-w-[200px] bg-white border border-clinical-line rounded p-3 shadow-sm hover:border-clinical-blue transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-bold text-clinical-ink">{rc.category?.toUpperCase() || 'GENERAL'}</span>
                        <span className={cn(
                          "text-[9px] font-black px-1.5 py-0.5 rounded",
                          rc.score >= 80 ? "bg-clinical-green/10 text-clinical-green" : "bg-clinical-amber/10 text-clinical-amber"
                        )}>{rc.score}%</span>
                      </div>
                      <div className="text-xs font-bold text-clinical-slate leading-tight truncate">{rc.patient_name}</div>
                      <div className="text-[9px] text-clinical-slate opacity-60 mt-1 uppercase">DX: {rc.correct_diagnosis}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-[10px] text-clinical-slate uppercase opacity-40 py-2">No recent clinical history found.</div>
                )}
              </div>
            </div>

            <div className="bg-clinical-bg p-4 border-t border-clinical-line flex items-center justify-center gap-3">
              <div className="w-1.5 h-1.5 bg-clinical-blue rounded-full animate-pulse" />
              <p className="text-[9px] text-clinical-slate uppercase font-bold tracking-widest">Generative engine creates unique patient profiles on every pick.</p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

