import * as Sentry from '@sentry/react';
import React, { Component, useState, useRef, useCallback, type ErrorInfo, type ReactNode } from 'react';
import { X, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { useCase } from '../contexts/CaseContext';
import { useNavigation } from '../contexts/NavigationContext';
import { searchOrders } from '../services/geminiService';

import { AuthModal } from './Auth';
import { CaseLibrary } from './CaseLibrary';
import { CommandPalette } from './CommandPalette';
import VitalsExpanded from './VitalsExpanded';
import { DiagnosisPad } from './DiagnosisPad';
import { StageCommitGate } from './StageCommitGate';
import { TimeAdvanceModal } from './TimeAdvanceModal';
import { AssessmentTab } from './tabs/AssessmentTab';
import { ArchiveView } from './ArchiveView';
import { ClinicalTimeline } from './ClinicalTimeline';

import type { OrderSearchResult } from '../types';

// ── Error boundary ─────────────────────────────────────────────────────────────
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }
  render() {
    if (this.state.hasError) return (
      <div className="min-h-screen bg-white flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <p className="text-lg font-medium text-gray-900 mb-2">Something went wrong</p>
          <p className="text-sm text-gray-500 mb-6">The simulator encountered an error.</p>
          <button onClick={() => window.location.reload()} className="px-6 py-2.5 bg-black text-white rounded-full text-sm font-medium">Restart</button>
        </div>
      </div>
    );
    return this.props.children;
  }
}

export { ErrorBoundary };
export function ClinicalLayout() { return <ErrorBoundary><ClinicalLayoutInner /></ErrorBoundary>; }

// ── Order bar ──────────────────────────────────────────────────────────────────
const CATEGORY_COLOR: Record<string, string> = {
  lab: 'bg-blue-50 text-blue-600', imaging: 'bg-purple-50 text-purple-600',
  medication: 'bg-green-50 text-green-600', consult: 'bg-amber-50 text-amber-700',
  procedure: 'bg-gray-100 text-gray-600',
};

function OrderBar({
  caseId, simTime, busy,
  onExecute, onOpenTimeAdvance, onTransfer,
  onOrderTest, onOrderMedication, onOpenAssessment, onConsult,
}: {
  caseId: string | undefined;
  simTime: number;
  busy: boolean;
  onExecute: (text: string) => Promise<void>;
  onOpenTimeAdvance: () => void;
  onTransfer: (dept: string) => void;
  onOrderTest: (type: 'lab' | 'imaging', name: string) => Promise<void>;
  onOrderMedication: (name: string, route?: string, freq?: string) => Promise<void>;
  onOpenAssessment: () => void;
  onConsult: () => void;
}) {
  const [value, setValue] = useState('');
  const [suggestions, setSuggestions] = useState<OrderSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  const search = useCallback((q: string) => {
    clearTimeout(debounceRef.current);
    if (!q.trim() || !caseId) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try { setSuggestions((await searchOrders(caseId, q)).results.slice(0, 6)); }
      catch { setSuggestions([]); }
      finally { setSearching(false); }
    }, 280);
  }, [caseId]);

  const clear = () => { setValue(''); setSuggestions([]); };

  const execute = async () => {
    const text = value.trim();
    if (!text || busy || placing) return;
    clear();
    await onExecute(text);
  };

  const place = async (r: OrderSearchResult) => {
    if (busy || placing) return;
    clear();
    setPlacing(true);
    try {
      if (r.category === 'lab') await onOrderTest('lab', r.name);
      else if (r.category === 'imaging') await onOrderTest('imaging', r.name);
      else if (r.category === 'medication') await onOrderMedication(r.name, r.route, r.frequency);
      else await onExecute(`${r.category === 'consult' ? 'Consult' : 'Perform'}: ${r.name}`);
    } finally { setPlacing(false); }
  };

  const isBusy = busy || placing;
  const penaltyLevel = simTime >= 90 ? 'high' : simTime >= 60 ? 'moderate' : simTime >= 45 ? 'low' : null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white">
      {/* Suggestions */}
      <AnimatePresence>
        {suggestions.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
            className="border-t border-gray-100 max-h-52 overflow-y-auto bg-white">
            {suggestions.map(r => (
              <button key={r.name} onClick={() => place(r)} disabled={isBusy}
                className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800">{r.name}</p>
                  {(r.route || r.frequency) && <p className="text-[10px] text-gray-400">{[r.route, r.frequency].filter(Boolean).join(' · ')}</p>}
                </div>
                <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0', CATEGORY_COLOR[r.category] ?? 'bg-gray-100 text-gray-500')}>
                  {r.category}
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transfer picker */}
      <AnimatePresence>
        {transferOpen && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
            className="flex gap-5 px-4 py-2.5 border-t border-gray-100">
            {['ICU', 'OR', 'Cath Lab', 'Ward', 'Radiology'].map(d => (
              <button key={d} onClick={() => { onTransfer(d); setTransferOpen(false); }} disabled={isBusy}
                className="text-xs text-gray-500 hover:text-gray-900 transition-colors disabled:opacity-30">{d}</button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Time pressure */}
      {penaltyLevel && (
        <p className={cn('px-4 py-1 text-[10px] border-t border-gray-50',
          penaltyLevel === 'low' ? 'text-amber-500' : penaltyLevel === 'moderate' ? 'text-orange-500' : 'text-red-500 font-medium')}>
          {penaltyLevel === 'low' && `⏱ T+${simTime}m — efficiency score beginning to drop.`}
          {penaltyLevel === 'moderate' && `⏱ T+${simTime}m — significant time penalty accumulating.`}
          {penaltyLevel === 'high' && `⏱ T+${simTime}m — major efficiency penalty.`}
        </p>
      )}

      {/* Input */}
      <div className="border-t border-gray-100 px-4 pt-2.5 pb-3">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={e => { setValue(e.target.value); search(e.target.value); }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); execute(); }
              if (e.key === 'Escape') clear();
            }}
            placeholder={isBusy ? 'Processing…' : searching ? 'Searching…' : 'Order, medication, or intervention…'}
            disabled={isBusy || !caseId}
            className="flex-1 text-sm py-1 focus:outline-none bg-transparent placeholder-gray-300 disabled:opacity-40"
            autoComplete="off"
          />
          {value.trim() && !isBusy && (
            <button onClick={execute} className="shrink-0 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-full">
              Execute
            </button>
          )}
        </div>
        <div className="flex items-center gap-4 pt-1">
          <button onClick={onOpenTimeAdvance} disabled={isBusy || !caseId} className="text-xs text-gray-400 hover:text-gray-700 transition-colors disabled:opacity-30">Advance time</button>
          <button onClick={() => setTransferOpen(p => !p)} disabled={isBusy || !caseId} className={cn('text-xs transition-colors disabled:opacity-30', transferOpen ? 'text-gray-900' : 'text-gray-400 hover:text-gray-700')}>Transfer</button>
          <button onClick={onConsult} disabled={isBusy || !caseId} className="text-xs text-gray-400 hover:text-gray-700 transition-colors disabled:opacity-30">Consult AI</button>
          <button onClick={onOpenAssessment} disabled={!caseId} className="ml-auto text-xs text-gray-400 hover:text-gray-700 transition-colors disabled:opacity-30">End case →</button>
        </div>
      </div>
    </div>
  );
}

// ── Main inner component ───────────────────────────────────────────────────────
function ClinicalLayoutInner() {
  const [vitalsExpanded, setVitalsExpanded]   = useState(false);
  const [gcsState, setGcsState]               = useState({ eyes: 4, verbal: 5, motor: 6 });
  const [timeAdvanceOpen, setTimeAdvanceOpen] = useState(false);
  const [assessmentOpen, setAssessmentOpen]   = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const { user, isAuthOpen, setIsAuthOpen, handleLogout, isSupabaseConfigured, isAuthLoading, isRecovery, clearRecovery } = useAuth();
  const {
    medicalCase, loading, error, loadingStep, patientOutcome, vitalsHistory,
    consultantAdvice, isConsulting, isConsultOpen, setIsConsultOpen,
    intervening, calling, userNotes, setUserNotes, evaluation, submitting,
    differential, setDifferential, logs, reasoning,
    isDxPadOpen, setIsDxPadOpen, dxPadInitialTab,
    pendingStage, setPendingStage,
    loadNewCase, handlePerformIntervention, handleConsult,
    handleOrderTest, handleOrderMedication, handleDiscontinueMedication,
    handleAdvanceTime, handleEndCase, setMedicalCase, simTime,
  } = useCase();
  const { isLibraryOpen, setIsLibraryOpen, isCommandOpen, setIsCommandOpen } = useNavigation();

  // Abnormal vitals alert strip
  const abnormalVitals: { label: string; value: string; critical: boolean }[] = [];
  if (medicalCase?.vitals) {
    const v = medicalCase.vitals;
    if (v.heartRate > 120 || v.heartRate < 50) abnormalVitals.push({ label: 'HR', value: `${v.heartRate}`, critical: v.heartRate > 150 || v.heartRate < 40 });
    if (v.oxygenSaturation < 94) abnormalVitals.push({ label: 'SpO2', value: `${v.oxygenSaturation}%`, critical: v.oxygenSaturation < 88 });
    const sbp = parseInt(medicalCase.vitals.bloodPressure.split('/')[0]) || 120;
    if (sbp < 90 || sbp > 160) abnormalVitals.push({ label: 'BP', value: medicalCase.vitals.bloodPressure, critical: sbp < 80 || sbp > 180 });
    if (v.respiratoryRate > 24 || v.respiratoryRate < 10) abnormalVitals.push({ label: 'RR', value: `${v.respiratoryRate}`, critical: v.respiratoryRate > 30 || v.respiratoryRate < 8 });
    if (v.temperature > 38.5 || v.temperature < 36) abnormalVitals.push({ label: 'T', value: `${v.temperature}°`, critical: v.temperature > 40 || v.temperature < 34 });
  }
  const hasCritical = abnormalVitals.some(v => v.critical);

  // ── Auth gate ────────────────────────────────────────────────────────────────
  if (isSupabaseConfigured && !isAuthLoading && !user) return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8">
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} isRecovery={isRecovery} onRecoveryHandled={clearRecovery} />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-sm">
        <div className="w-14 h-14 bg-gray-900 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <span className="text-white text-xl font-black">Rx</span>
        </div>
        <h1 className="text-2xl font-black text-gray-900 mb-2 uppercase tracking-tight">OpenEHR Sim</h1>
        <p className="text-sm text-gray-500 mb-8 leading-relaxed">USMLE Step 3 CCS simulator.</p>
        <button onClick={() => setIsAuthOpen(true)} className="px-8 py-3 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors">Sign in</button>
      </motion.div>
    </div>
  );

  // ── Loading / error ──────────────────────────────────────────────────────────
  if (isAuthLoading || loading || error) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center max-w-xs">
        {error ? (<>
          <p className="text-base font-medium text-gray-900 mb-2">Connection Failed</p>
          <p className="text-sm text-gray-500 mb-6">{error}</p>
          <button onClick={() => loadNewCase()} className="px-6 py-2.5 bg-black text-white rounded-full text-sm font-medium">Try Again</button>
        </>) : (<>
          <div className="w-8 h-8 mx-auto mb-4 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
          <p className="text-sm text-gray-500">{loadingStep}</p>
        </>)}
      </motion.div>
    </div>
  );

  // ── Main render ──────────────────────────────────────────────────────────────
  return (
    <div className={cn('h-screen flex flex-col overflow-hidden transition-colors duration-500', hasCritical ? 'bg-red-50' : 'bg-white')}>

      {/* Global modals */}
      <VitalsExpanded isOpen={vitalsExpanded} onClose={() => setVitalsExpanded(false)} vitalsHistory={vitalsHistory} />
      <CaseLibrary isOpen={isLibraryOpen} onClose={() => setIsLibraryOpen(false)} onSelectCase={(d, c, e) => { setIsLibraryOpen(false); loadNewCase(d, c, e); }} />
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} isRecovery={isRecovery} onRecoveryHandled={clearRecovery} />
      <CommandPalette isOpen={isCommandOpen} onClose={() => setIsCommandOpen(false)} onNavigate={() => {}} onNewCase={() => setIsLibraryOpen(true)} onConsult={handleConsult} hasArchive={!!user} onOrderTest={medicalCase ? handleOrderTest : undefined} onAdminister={medicalCase ? med => handlePerformIntervention(2, `Administer ${med}`) : undefined} onAdvanceTime={medicalCase ? handleAdvanceTime : undefined} />
      {timeAdvanceOpen && medicalCase && <TimeAdvanceModal medicalCase={medicalCase} simTime={simTime} intervening={intervening} onAdvance={handleAdvanceTime} onClose={() => setTimeAdvanceOpen(false)} />}

      {/* Header */}
      <header className="h-12 flex items-center px-4 shrink-0 z-30">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button onClick={() => setVitalsExpanded(true)} className="text-sm font-semibold text-gray-900 truncate hover:underline">
            {medicalCase?.patientName}
          </button>
          <span className="text-xs text-gray-400">{medicalCase?.age}{medicalCase?.gender?.[0]?.toUpperCase()}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={cn('text-xs font-mono font-medium',
            simTime === 0 ? 'text-gray-300' : simTime < 30 ? 'text-gray-500' : simTime < 60 ? 'text-amber-500' : 'text-red-500')}>
            T+{simTime}m
          </span>
          <button onClick={() => setIsLibraryOpen(true)} className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors" aria-label="New case">
            <RefreshCw className="w-4 h-4" />
          </button>
          {user && (
            <div className="relative">
              <button onClick={() => setAccountMenuOpen(p => !p)} className="w-6 h-6 bg-gray-900 rounded-full flex items-center justify-center text-[10px] font-medium text-white">
                {user.email?.[0].toUpperCase()}
              </button>
              {accountMenuOpen && (<>
                <div className="fixed inset-0 z-40" onClick={() => setAccountMenuOpen(false)} />
                <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-xl shadow-lg py-2 px-1 min-w-[160px] z-50">
                  <p className="px-3 py-1 text-[10px] text-gray-400 truncate">{user.email}</p>
                  <div className="border-t border-gray-100 mt-1 pt-1">
                    <button onClick={() => { setAccountMenuOpen(false); setAssessmentOpen(true); }} className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 rounded-lg">History &amp; score</button>
                    <button onClick={() => { setAccountMenuOpen(false); handleLogout(); }} className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg">Sign out</button>
                  </div>
                </div>
              </>)}
            </div>
          )}
        </div>
      </header>

      {/* Vitals alert strip */}
      <AnimatePresence>
        {(abnormalVitals.length > 0 || (medicalCase?.physiologicalTrend && !['stable','improving'].includes(medicalCase.physiologicalTrend))) && (
          <motion.button initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            onClick={() => setVitalsExpanded(true)}
            className={cn('flex items-center justify-center gap-4 py-2 px-4 shrink-0', hasCritical || medicalCase?.physiologicalTrend === 'critical' ? 'bg-red-100' : 'bg-amber-50')}>
            {abnormalVitals.map((v, i) => <span key={i} className={cn('text-xs font-bold font-mono', v.critical ? 'text-red-600' : 'text-amber-600')}>{v.label} {v.value}</span>)}
            {medicalCase?.physiologicalTrend === 'declining' && <span className="text-xs font-bold text-amber-600">↓ Declining</span>}
            {medicalCase?.physiologicalTrend === 'critical'  && <span className="text-xs font-bold text-red-600 animate-pulse">⚠ Critical deterioration</span>}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Patient outcome banner */}
      <AnimatePresence>
        {patientOutcome && patientOutcome !== 'alive' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className={cn('py-3 px-4 flex items-center justify-center gap-3 shrink-0', patientOutcome === 'deceased' ? 'bg-gray-900 text-white' : 'bg-red-600 text-white')}>
            <span className="text-sm font-medium">{patientOutcome === 'deceased' ? 'Patient expired' : 'Critical deterioration'}</span>
            <button onClick={() => loadNewCase()} className="text-xs underline opacity-70 hover:opacity-100">New case</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scrollable timeline */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-6 pb-36">
        <div className="max-w-xl mx-auto pt-6">
          {medicalCase && (
            <ClinicalTimeline
              medicalCase={medicalCase}
              simTime={simTime}
              intervening={intervening}
              gcsState={gcsState}
              onGcsChange={(cat, score) => setGcsState(prev => ({ ...prev, [cat]: score }))}
              onExamineSystem={(system, finding) => {
                reasoning.addFinding({ source: 'exam', text: `${system}: ${finding.slice(0, 60)}`, relevance: 'none', addedAt: medicalCase.simulationTime });
                setMedicalCase(prev => prev ? ({
                  ...prev,
                  clinicalActions: [...(prev.clinicalActions || []), {
                    id: `exam-${Date.now()}`, timestamp: prev.simulationTime,
                    type: 'exam' as const, description: `Examined ${system}: ${finding.slice(0, 80)}`,
                  }],
                }) : prev);
              }}
              onDiscontinueMedication={handleDiscontinueMedication}
            />
          )}
        </div>
      </main>

      {/* Sticky order bar */}
      <OrderBar
        caseId={medicalCase?.id}
        simTime={simTime}
        busy={intervening || calling}
        onExecute={text => handlePerformIntervention(5, text)}
        onOpenTimeAdvance={() => setTimeAdvanceOpen(true)}
        onTransfer={dept => handlePerformIntervention(0, `Transfer to ${dept}`)}
        onOrderTest={handleOrderTest}
        onOrderMedication={handleOrderMedication}
        onOpenAssessment={() => setAssessmentOpen(true)}
        onConsult={handleConsult}
      />

      {/* Assessment / history overlay */}
      <AnimatePresence>
        {assessmentOpen && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="fixed inset-0 bg-white z-50 overflow-y-auto">
            <div className="max-w-xl mx-auto px-4 py-6 pb-24">
              <button onClick={() => setAssessmentOpen(false)} className="text-sm text-gray-400 hover:text-gray-700 transition-colors mb-8 block">← Back to case</button>
              <AssessmentTab medicalCase={medicalCase} simTime={simTime} userNotes={userNotes} evaluation={evaluation} submitting={submitting} logs={logs} differential={differential} onDifferentialChange={setDifferential} onNotesChange={setUserNotes} onEndCase={handleEndCase} onNewCase={() => { setAssessmentOpen(false); loadNewCase(); }} />
              {user && <div className="mt-12 border-t border-gray-100 pt-8"><ArchiveView user={user} /></div>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating DiagnosisPad */}
      {medicalCase && (
        <AnimatePresence>
          <DiagnosisPad
            isOpen={isDxPadOpen} onToggle={() => setIsDxPadOpen(p => !p)} initialTab={dxPadInitialTab}
            problemRepresentation={reasoning.problemRepresentation} onProblemRepresentationChange={reasoning.setProblemRepresentation}
            prHistory={reasoning.prHistory} prIsDirty={reasoning.prIsDirty} currentStage={reasoning.currentStage}
            differentials={reasoning.differentials} onAddDifferential={reasoning.addDifferential}
            onRemoveDifferential={reasoning.removeDifferential} onSetLeadDiagnosis={reasoning.setLeadDiagnosis}
            onUpdateConfidence={reasoning.updateConfidence} onSetIllnessScript={reasoning.setIllnessScript}
            findings={reasoning.findings} onRemoveFinding={reasoning.removeFinding}
            onUpdateRelevance={reasoning.updateRelevance} onUpdateFindingRelevanceForDx={reasoning.updateFindingRelevanceForDx}
          />
        </AnimatePresence>
      )}

      {/* Stage Commit Gate */}
      {medicalCase && pendingStage && (
        <StageCommitGate
          isOpen={!!pendingStage} fromStage={reasoning.currentStage} toStage={pendingStage}
          problemRepresentation={reasoning.problemRepresentation} onProblemRepresentationChange={reasoning.setProblemRepresentation}
          differentials={reasoning.differentials} onSetLead={reasoning.setLeadDiagnosis}
          findings={reasoning.findings} previousPrSnapshot={reasoning.latestPrSnapshot}
          unmetRequirements={reasoning.checkStageGate(reasoning.currentStage)}
          onCommit={fromStage => {
            const snapId = reasoning.commitStage(fromStage, simTime);
            if (snapId && pendingStage) { reasoning.goToStage(pendingStage); setPendingStage(null); }
            return snapId;
          }}
          onCancel={() => setPendingStage(null)}
        />
      )}

      {/* AI Consultant slide-over */}
      <AnimatePresence>
        {isConsultOpen && (<>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsConsultOpen(false)} className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[100]" />
          <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 260 }} className="fixed bottom-0 left-0 right-0 max-h-[80vh] bg-white rounded-t-2xl shadow-2xl z-[101] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div><h3 className="text-sm font-semibold text-gray-900">AI Consultant</h3><p className="text-[10px] text-gray-400">Specialist reasoning</p></div>
              <button onClick={() => setIsConsultOpen(false)} className="p-2 hover:bg-gray-100 rounded-full"><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {isConsulting ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
                  <p className="text-xs text-gray-400">Thinking...</p>
                </div>
              ) : consultantAdvice ? (<>
                <div className="bg-gray-50 rounded-xl p-4"><p className="text-sm text-gray-900 leading-relaxed italic">"{consultantAdvice.advice}"</p></div>
                <div><p className="text-[10px] font-medium text-gray-400 uppercase mb-1">Reasoning</p><p className="text-sm text-gray-700 leading-relaxed">{consultantAdvice.reasoning}</p></div>
                <div>
                  <p className="text-[10px] font-medium text-gray-400 uppercase mb-2">Next steps</p>
                  <div className="space-y-2">
                    {consultantAdvice.recommendedActions.map((action, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full bg-gray-900 text-white flex items-center justify-center text-[10px] font-medium shrink-0">{i + 1}</span>
                        <p className="text-sm text-gray-700 pt-0.5">{action}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>) : <div className="text-center py-12"><p className="text-sm text-gray-400">No consultation yet</p></div>}
            </div>
          </motion.div>
        </>)}
      </AnimatePresence>
    </div>
  );
}
