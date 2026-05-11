/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, Component, ErrorInfo, ReactNode } from 'react';
import { 
  Heart, 
  Activity, 
  Thermometer, 
  Wind, 
  Droplets, 
  Clipboard, 
  Stethoscope, 
  FlaskConical, 
  FileSearch, 
  ChevronRight, 
  AlertCircle,
  CheckCircle2,
  User,
  History,
  Send,
  Loader2,
  MapPin,
  Phone,
  MessageSquare,
  UserPlus,
  RefreshCw,
  Clock
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
import { generateMedicalCase, evaluateDiagnosis, performIntervention, staffCall } from './services/geminiService';
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

function ClinicalSimulator() {
  const [medicalCase, setMedicalCase] = useState<MedicalCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'hpi' | 'exam' | 'labs' | 'imaging' | 'treatment' | 'comms'>('hpi');
  const [userDiagnosis, setUserDiagnosis] = useState('');
  const [interventionInput, setInterventionInput] = useState('');
  const [feedback, setFeedback] = useState<{ score: number; feedback: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [intervening, setIntervening] = useState(false);
  const [calling, setCalling] = useState(false);
  const [callTarget, setCallTarget] = useState('Nursing Station');
  const [callMessage, setCallMessage] = useState('');
  const [vitalsHistory, setVitalsHistory] = useState<{ time: string; hr: number }[]>([]);
  const [revealedLabs, setRevealedLabs] = useState<string[]>([]);
  const [logs, setLogs] = useState<{ time: string; text: string }[]>([]);

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

  const loadNewCase = useCallback(async () => {
    setLoading(true);
    setError(null);
    setFeedback(null);
    setUserDiagnosis('');
    setRevealedLabs([]);
    setLogs([{ time: new Date().toLocaleTimeString(), text: 'ADMIT: Patient registered in system.' }]);
    try {
      const newCase = await generateMedicalCase();
      setMedicalCase(newCase);
      const hrBase = newCase.vitals?.heartRate || 75;
      const initialHistory = Array.from({ length: 20 }, (_, i) => ({
        time: `${i}s`,
        hr: hrBase + (Math.random() * 6 - 3)
      }));
      setVitalsHistory(initialHistory);
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
        const currentHr = medicalCase?.vitals?.heartRate || 75;
        const next = [...prev.slice(1), {
          time: new Date().toLocaleTimeString(),
          hr: currentHr + (Math.random() * 2 - 1)
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
      <div className="min-h-screen bg-clinical-bg flex items-center justify-center font-sans">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-6 max-w-md text-center">
          {error ? (
            <div className="p-8 bg-clinical-surface border border-clinical-line rounded-lg shadow-sm">
              <AlertCircle className="w-10 h-10 text-clinical-red mx-auto mb-4" />
              <h2 className="text-lg font-bold mb-2 text-clinical-ink">System Fault</h2>
              <p className="text-sm text-clinical-slate mb-6 leading-relaxed">{error}</p>
              <button onClick={loadNewCase} className="w-full py-2 bg-clinical-blue text-white rounded font-medium text-sm flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4" /> Restart Station
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <Loader2 className="w-8 h-8 animate-spin text-clinical-blue mb-4" />
              <p className="text-xs uppercase tracking-widest font-bold text-clinical-slate">Synchronizing Clinic Data...</p>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  const simTime = medicalCase?.simulationTime || 0;

  return (
    <div className="min-h-screen bg-clinical-bg flex flex-col overflow-hidden text-clinical-ink">
      {/* EHR Header */}
      <header className="h-14 bg-clinical-surface border-b border-clinical-line flex items-center px-6 shrink-0 shadow-sm z-30">
        <div className="flex items-center gap-6">
           <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-clinical-blue rounded-sm flex items-center justify-center">
                <Activity className="text-white w-3 h-3" />
              </div>
              <span className="text-sm font-bold tracking-tight">OpenEHR v4.2</span>
           </div>
           <div className="h-6 w-px bg-clinical-line" />
           <div className="text-[11px] font-bold text-clinical-slate uppercase flex items-center gap-3">
              <span className="flex items-center gap-1"><User className="w-3 h-3" /> <span className="text-clinical-ink">{medicalCase?.patientName}</span></span>
              <div className="h-3 w-px bg-clinical-line" />
              <span>ID: <span className="text-clinical-ink">#882-019-X</span></span>
              <div className="h-3 w-px bg-clinical-line" />
              <span className="flex items-center gap-1 text-clinical-blue"><MapPin className="w-3 h-3" /> {medicalCase?.currentLocation || 'ER Bay 4'}</span>
           </div>
        </div>

        <div className="ml-auto flex items-center gap-6">
           <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold text-clinical-slate uppercase tracking-widest">Elapsed simulation time</span>
              <span className="text-lg font-mono font-bold text-clinical-blue">T + {simTime} min</span>
           </div>
           <button onClick={loadNewCase} className="p-2 hover:bg-clinical-bg rounded text-clinical-slate transition-colors">
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
            className="bg-clinical-red text-white py-2 px-6 flex items-center justify-between border-b border-red-900 overflow-hidden shrink-0"
          >
            <div className="flex items-center gap-4">
              <AlertCircle className="w-5 h-5 animate-pulse" />
              <div className="flex gap-4">
                {medicalCase?.activeAlarms.map((alarm, i) => (
                  <span key={i} className="text-[11px] font-bold uppercase tracking-widest bg-white/20 px-3 py-0.5 rounded flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                    {alarm}
                  </span>
                ))}
              </div>
            </div>
            <span className="text-[10px] font-mono opacity-60">SYSTEM ALERT: CRITICAL PHYSIOLOGY DETECTED</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Vitals Rail */}
      <div className="h-16 bg-white border-b border-clinical-line flex items-center px-2 gap-2 shrink-0 overflow-x-auto">
          <div className="flex items-center gap-1 px-4 border-r border-clinical-line h-full mr-4">
             <div className={cn(
               "w-3 h-3 rounded-full animate-pulse",
               medicalCase?.physiologicalTrend === 'improving' ? "bg-clinical-green" :
               medicalCase?.physiologicalTrend === 'declining' ? "bg-clinical-amber" :
               medicalCase?.physiologicalTrend === 'critical' ? "bg-clinical-red" : "bg-clinical-slate"
             )} />
             <span className="text-[10px] font-bold text-clinical-slate uppercase tracking-widest ml-1">{medicalCase?.physiologicalTrend}</span>
          </div>
          <ClinicalVital 
            label="HR" 
            value={Math.round(vitalsHistory[vitalsHistory.length - 1]?.hr || 0)} 
            unit="BPM" 
            status="normal" 
            isAlarming={medicalCase?.activeAlarms.some(a => a.includes('HR') || a.includes('Pulse') || a.includes('Bradycardia') || a.includes('Tachycardia'))} 
          />
          <ClinicalVital 
            label="BP" 
            value={medicalCase?.vitals?.bloodPressure || '--'} 
            unit="mmHg" 
            status="normal" 
            isAlarming={medicalCase?.activeAlarms.some(a => a.includes('BP') || a.includes('Pressure') || a.includes('Hypotension') || a.includes('Hypertension'))}
          />
          <ClinicalVital 
            label="RR" 
            value={medicalCase?.vitals?.respiratoryRate || '--'} 
            unit="/min" 
            status="normal" 
            isAlarming={medicalCase?.activeAlarms.some(a => a.includes('RR') || a.includes('Respiratory') || a.includes('Tachypnea') || a.includes('Apnea'))}
          />
          <ClinicalVital 
            label="SpO2" 
            value={medicalCase?.vitals?.oxygenSaturation || 0} 
            unit="%" 
            status="normal" 
            isAlarming={medicalCase?.activeAlarms.some(a => a.includes('SpO2') || a.includes('Saturation') || a.includes('Hypoxia'))}
          />
          <ClinicalVital 
            label="T" 
            value={medicalCase?.vitals?.temperature || 0} 
            unit="°C" 
            status="normal" 
            isAlarming={medicalCase?.activeAlarms.some(a => a.includes('Temp') || a.includes('Temperature') || a.includes('Fever'))}
          />
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Navigation Sidebar */}
        <nav className="w-60 bg-clinical-surface border-r border-clinical-line flex flex-col p-4 z-20 shrink-0">
           <div className="space-y-1">
              <NavTab active={activeTab === 'hpi'} icon={<Clipboard className="w-4 h-4" />} label="History & Intake" onClick={() => setActiveTab('hpi')} />
              <NavTab active={activeTab === 'exam'} icon={<Stethoscope className="w-4 h-4" />} label="Physical Selection" onClick={() => setActiveTab('exam')} />
              <NavTab active={activeTab === 'labs'} icon={<FlaskConical className="w-4 h-4" />} label="Order Results" onClick={() => setActiveTab('labs')} />
              <NavTab active={activeTab === 'imaging'} icon={<FileSearch className="w-4 h-4" />} label="Radiology PACS" onClick={() => setActiveTab('imaging')} />
              <NavTab active={activeTab === 'comms'} icon={<Phone className="w-4 h-4" />} label="Communication" onClick={() => setActiveTab('comms')} />
              <NavTab active={activeTab === 'treatment'} icon={<Activity className="w-4 h-4" />} label="Interventions" onClick={() => setActiveTab('treatment')} />
           </div>

           <div className="mt-auto pt-6 border-t border-clinical-line">
              <h3 className="text-[10px] font-bold text-clinical-slate uppercase tracking-widest mb-3 px-2">Care Summary</h3>
              <div className="p-4 bg-yellow-50/50 border border-yellow-200/50 rounded-lg">
                 <p className="text-[11px] text-yellow-800 leading-relaxed italic">
                    "{medicalCase?.currentCondition}"
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
              <motion.div key="exam" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-clinical-surface border border-clinical-line rounded shadow-sm overflow-hidden">
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
              </motion.div>
            )}

            {activeTab === 'labs' && (
              <motion.div key="labs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-clinical-surface border border-clinical-line rounded shadow-sm overflow-hidden">
                <div className="bg-clinical-bg p-3 border-b border-clinical-line flex justify-between items-center">
                  <span className="text-[11px] font-bold text-clinical-slate uppercase">Stat Laboratory Panel</span>
                  <span className="text-[9px] text-clinical-slate italic">Reference values based on CLSI standards</span>
                </div>
                <table className="clinical-table">
                  <thead>
                    <tr>
                      <th>Test Component</th>
                      <th>Status</th>
                      <th>Result</th>
                      <th>Reference</th>
                      <th>Flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(medicalCase?.labs || []).map((lab) => {
                      const isAvailable = lab.orderedAt !== undefined && lab.availableAt !== undefined && lab.availableAt <= simTime;
                      const isPending = lab.orderedAt !== undefined && (lab.availableAt === undefined || lab.availableAt > simTime);
                      
                      return (
                        <tr key={lab.name} className="hover:bg-clinical-bg/30 transition-colors">
                          <td className="font-bold text-clinical-ink">{lab.name}</td>
                          <td>
                            {!lab.orderedAt ? (
                              <button 
                                onClick={() => handleOrderDiagnostic('lab', lab.name)}
                                className="text-[10px] font-bold text-clinical-blue uppercase hover:underline"
                              >
                                [Order Stat]
                              </button>
                            ) : isPending ? (
                              <span className="text-[10px] font-bold text-clinical-amber uppercase animate-pulse">Pending... ({lab.availableAt! - simTime}m)</span>
                            ) : (
                              <span className="text-[10px] font-bold text-clinical-green uppercase">Results Ready</span>
                            )}
                          </td>
                          <td className="font-mono text-sm">
                            {isAvailable ? lab.value : <span className="opacity-20">---</span>}
                          </td>
                          <td className="text-[11px] text-clinical-slate">{lab.normalRange} {lab.unit}</td>
                          <td>
                            {isAvailable && (
                               <span className={cn(
                                 "text-[10px] font-bold uppercase",
                                 lab.status === 'critical' ? "text-clinical-red" : lab.status === 'abnormal' ? "text-clinical-amber" : "text-clinical-green"
                               )}>{lab.status}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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
                        <div className="grid grid-cols-2 gap-3">
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

                  <div className="bg-clinical-surface border border-clinical-line rounded shadow-sm flex flex-col h-[600px]">
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
                                   <p className="text-[11px] text-clinical-slate border-l-2 border-clinical-blue/30 pl-4 py-1 italic">
                                     {a.impact || a.result}
                                   </p>
                                </div>
                             </div>
                           ))
                         )}
                      </div>
                  </div>
               </motion.div>
            )}
          </AnimatePresence>

          {/* Diagnostic Console - Bottom Persistent */}
          <footer className="mt-auto bg-clinical-surface border border-clinical-line rounded p-6 shadow-md shrink-0">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-[11px] font-bold text-clinical-slate uppercase tracking-widest">Attending's Assessment & Plan</h3>
                {feedback && <div className="px-3 py-1 bg-clinical-blue text-white rounded text-[10px] font-bold">CASE TERMINATED</div>}
             </div>
             
             {feedback ? (
               <div className="flex gap-10 items-start">
                  <div className="w-24 h-24 rounded-full border-8 border-clinical-bg flex items-center justify-center relative">
                     <svg className="absolute inset-0 w-full h-full -rotate-90">
                        <circle cx="48" cy="48" r="40" fill="none" stroke="#E2E8F0" strokeWidth="8" />
                        <circle cx="48" cy="48" r="40" fill="none" stroke="#3182CE" strokeWidth="8" strokeDasharray={`${feedback.score * 2.51} 251`} className="transition-all duration-1000" />
                     </svg>
                     <span className="text-2xl font-bold text-clinical-ink">{feedback.score}</span>
                  </div>
                  <div className="flex-1 space-y-2">
                     <h4 className="text-sm font-bold text-clinical-blue">Clinical Review Complete</h4>
                     <p className="text-xs text-clinical-slate leading-relaxed bg-clinical-bg p-4 rounded italic select-none">"{feedback.feedback}"</p>
                     <p className="text-[10px] text-clinical-slate uppercase mt-4">Diagnosis was: <span className="font-bold text-clinical-ink">{medicalCase?.correctDiagnosis || 'Unknown'}</span></p>
                     <button onClick={loadNewCase} className="mt-4 px-6 py-2 bg-clinical-blue text-white rounded text-xs font-bold uppercase transition-transform hover:scale-105 active:scale-95 shadow-lg shadow-clinical-blue/20">Next Clinical Case</button>
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

function ClinicalVital({ label, value, unit, status, isAlarming }: { label: string, value: string | number, unit: string, status: 'normal' | 'abnormal' | 'critical', isAlarming?: boolean }) {
  return (
    <div className={cn("flex flex-col px-4 py-2 transition-all", isAlarming && "bg-clinical-red/10 animate-pulse rounded border border-clinical-red/20")}>
      <div className="text-[9px] font-bold text-clinical-slate uppercase tracking-tighter opacity-70 mb-0.5 flex items-center gap-2">
        {label}
        {isAlarming && <div className="w-1.5 h-1.5 bg-clinical-red rounded-full" />}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={cn(
          "text-xl font-mono font-bold leading-none tracking-tight",
          isAlarming || status === 'critical' ? 'text-clinical-red' : status === 'abnormal' ? 'text-clinical-amber' : 'text-clinical-ink'
        )}>{value}</span>
        <span className="text-[10px] text-clinical-slate font-bold opacity-40 uppercase">{unit}</span>
      </div>
    </div>
  );
}

function NavTab({ active, icon, label, onClick }: { active: boolean, icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-md transition-all text-sm font-medium group",
        active 
          ? "bg-clinical-blue text-white shadow-md shadow-clinical-blue/20 translate-x-1" 
          : "text-clinical-slate hover:bg-clinical-bg"
      )}
    >
      <div className={cn("transition-colors", active ? "text-white" : "text-clinical-slate opacity-40")}>
        {icon}
      </div>
      <span className="tracking-tight">{label}</span>
      {active && <ChevronRight className="ml-auto w-3 h-3 text-white opacity-50" />}
    </button>
  );
}

