/**
 * ClinicalLayout — Steve Jobs-style radical minimal design.
 * One header line. Full content area. Context-aware vitals.
 * Bottom dot navigation. Nothing else.
 */

import * as Sentry from '@sentry/react';
import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import {
  RefreshCw,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { useCase } from '../contexts/CaseContext';
import { useNavigation } from '../contexts/NavigationContext';

// Components
import { AuthModal } from './Auth';
import { ClinicalNotes } from './ClinicalNotes';
import { ClinicalGuidelines } from './ClinicalGuidelines';
import { CaseLibrary } from './CaseLibrary';
import { CommandPalette } from './CommandPalette';
import VitalsExpanded from './VitalsExpanded';
import { DiagnosisPad } from './DiagnosisPad';
import { StageCommitGate } from './StageCommitGate';
import { ArchiveView } from './ArchiveView';
import { TimeAdvanceModal } from './TimeAdvanceModal';

// Tab components
import { HpiTab } from './tabs/HpiTab';
import { ExamTab } from './tabs/ExamTab';
import { LabsTab } from './tabs/LabsTab';
import { OrderSearchModal } from './OrderSearchModal';
import { PharmacyTab } from './tabs/PharmacyTab';
import { TreatmentTab } from './tabs/TreatmentTab';
import { CommsTab } from './tabs/CommsTab';
import { AssessmentTab } from './tabs/AssessmentTab';
import { TriageTab } from './tabs/TriageTab';
import { DxPauseTab } from './tabs/DxPauseTab';

import type { WorkflowStage } from '../types';

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
        <div className="min-h-screen bg-white flex items-center justify-center p-8">
          <div className="max-w-sm text-center">
            <p className="text-lg font-medium text-gray-900 mb-2">Something went wrong</p>
            <p className="text-sm text-gray-500 mb-6">The simulator encountered an error.</p>
            <button onClick={() => window.location.reload()} className="px-6 py-2.5 bg-black text-white rounded-full text-sm font-medium hover:bg-gray-800 transition-colors">
              Restart
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export { ErrorBoundary };

// ── Navigation dots config ────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'triage', label: 'Patient' },
  { id: 'hpi', label: 'History' },
  { id: 'exam', label: 'Exam' },
  { id: 'labs', label: 'Tests' },
  { id: 'treatment', label: 'Treat' },
  { id: 'assess', label: 'Score' },
  { id: 'archive', label: 'Stats' },
] as const;

// ── Main Layout ───────────────────────────────────────────────────────────────
export function ClinicalLayout() {
  return (
    <ErrorBoundary>
      <ClinicalLayoutInner />
    </ErrorBoundary>
  );
}

function ClinicalLayoutInner() {
  const [moreMenuOpen, setMoreMenuOpen] = React.useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = React.useState(false);

  // Pure UI state — only needed in this component, not shared globally
  const [vitalsExpanded, setVitalsExpanded] = React.useState(false);
  const [gcsState, setGcsState] = React.useState({ eyes: 4, verbal: 5, motor: 6 });
  const [gcsExpanded, setGcsExpanded] = React.useState(false);
  const [customMedInput, setCustomMedInput] = React.useState('');
  const [transferExpanded, setTransferExpanded] = React.useState(false);
  const [selectedLab, setSelectedLab] = React.useState<import('../types').LabResult | null>(null);
  const [revealedStudies, setRevealedStudies] = React.useState<string[]>([]);
  const [orderModalOpen, setOrderModalOpen] = React.useState(false);
  const [timeAdvanceOpen, setTimeAdvanceOpen] = React.useState(false);
  const realStartTimeRef = React.useRef<number>(Date.now());
  const [realElapsedMins, setRealElapsedMins] = React.useState(0);

  const { user, isAuthOpen, setIsAuthOpen, handleLogout, isSupabaseConfigured, isAuthLoading, isRecovery, clearRecovery } = useAuth();
  const {
    medicalCase,
    loading,
    error,
    loadingStep,
    patientOutcome,
    vitalsHistory,
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

    submitting,
    differential,
    setDifferential,
    callTarget,
    setCallTarget,
    callMessage,
    setCallMessage,
    calling,
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
    handleOrderMedication,
    handleDiscontinueMedication,
    handleAdvanceTime,
    handleEndCase,
    handleStageNavigate,
    simTime,
    setMedicalCase,
  } = useCase();
  const {
    activeTab,
    setActiveTab,
    isLibraryOpen,
    setIsLibraryOpen,
    isCommandOpen,
    setIsCommandOpen,
  } = useNavigation();

  const stageToTab: Record<WorkflowStage, string> = {
    triage: 'triage',
    history: 'hpi',
    exam: 'exam',
    diagnostics: 'labs',
    dxpause: 'dxpause',
    management: 'treatment',
  };

  // ── Real-time elapsed clock ───────────────────────────────────────────────
  React.useEffect(() => {
    if (!medicalCase) return;
    realStartTimeRef.current = Date.now();
    setRealElapsedMins(0);
  }, [medicalCase?.id]);

  React.useEffect(() => {
    const id = setInterval(() => {
      setRealElapsedMins(Math.floor((Date.now() - realStartTimeRef.current) / 60000));
    }, 15000);
    return () => clearInterval(id);
  }, []);

  // ── Derive abnormal vitals ──────────────────────────────────────────────────
  const abnormalVitals: { label: string; value: string; critical: boolean }[] = [];
  if (medicalCase?.vitals) {
    const v = medicalCase.vitals;
    if (v.heartRate > 120 || v.heartRate < 50)
      abnormalVitals.push({ label: 'HR', value: `${v.heartRate}`, critical: v.heartRate > 150 || v.heartRate < 40 });
    if (v.oxygenSaturation < 94)
      abnormalVitals.push({ label: 'SpO2', value: `${v.oxygenSaturation}%`, critical: v.oxygenSaturation < 88 });
    const sbp = parseInt(v.bloodPressure.split('/')[0]) || 120;
    if (sbp < 90 || sbp > 160)
      abnormalVitals.push({ label: 'BP', value: v.bloodPressure, critical: sbp < 80 || sbp > 180 });
    if (v.respiratoryRate > 24 || v.respiratoryRate < 10)
      abnormalVitals.push({ label: 'RR', value: `${v.respiratoryRate}`, critical: v.respiratoryRate > 30 || v.respiratoryRate < 8 });
    if (v.temperature > 38.5 || v.temperature < 36)
      abnormalVitals.push({ label: 'T', value: `${v.temperature}°`, critical: v.temperature > 40 || v.temperature < 34 });
  }
  const hasCritical = abnormalVitals.some(v => v.critical);

  // ── Auth gate ───────────────────────────────────────────────────────────────
  if (isSupabaseConfigured && !isAuthLoading && !user) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8">
        <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} isRecovery={isRecovery} onRecoveryHandled={clearRecovery} />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-sm">
          <div className="w-14 h-14 bg-gray-900 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <span className="text-white text-xl font-black">Rx</span>
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-2 uppercase tracking-tight">OpenEHR Sim</h1>
          <p className="text-sm text-gray-500 mb-8 leading-relaxed">
            USMLE Step 3 CCS simulator. Sign in to access cases and track your progress.
          </p>
          <button
            onClick={() => setIsAuthOpen(true)}
            className="px-8 py-3 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors"
          >
            Sign in
          </button>
        </motion.div>
      </div>
    );
  }

  // ── Loading screen ──────────────────────────────────────────────────────────
  if (isAuthLoading || loading || error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center max-w-xs">
          {error ? (
            <>
              <p className="text-base font-medium text-gray-900 mb-2">Connection Failed</p>
              <p className="text-sm text-gray-500 mb-6">{error}</p>
              <button onClick={() => loadNewCase()} className="px-6 py-2.5 bg-black text-white rounded-full text-sm font-medium hover:bg-gray-800 transition-colors">
                Try Again
              </button>
            </>
          ) : (
            <>
              <div className="w-8 h-8 mx-auto mb-4 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
              <p className="text-sm text-gray-500">{loadingStep}</p>
            </>
          )}
        </motion.div>
      </div>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────────
  return (
    <div className={cn(
      "h-screen flex flex-col overflow-hidden transition-colors duration-500",
      hasCritical ? "bg-red-50" : "bg-white"
    )} role="application">

      {/* Modals & overlays */}
      <VitalsExpanded isOpen={vitalsExpanded} onClose={() => setVitalsExpanded(false)} vitalsHistory={vitalsHistory} />
      <CaseLibrary isOpen={isLibraryOpen} onClose={() => setIsLibraryOpen(false)} onSelectCase={(d, c, e) => { setIsLibraryOpen(false); loadNewCase(d, c, e); }} />
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} isRecovery={isRecovery} onRecoveryHandled={clearRecovery} />

      {/* CCS-style unified order search modal */}
      {orderModalOpen && medicalCase && (
        <OrderSearchModal
          caseId={medicalCase.id}
          onClose={() => setOrderModalOpen(false)}
          onConfirm={async (items) => {
            for (const item of items) {
              if (item.category === 'lab') {
                await handleOrderTest('lab', item.name);
              } else if (item.category === 'imaging') {
                await handleOrderTest('imaging', item.name);
              } else if (item.category === 'medication') {
                await handleOrderMedication(item.name, item.route, item.frequency);
              }
            }
          }}
        />
      )}
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

      {/* ── Single header line ── */}
      <header className="h-12 flex items-center px-4 shrink-0 relative z-30">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button onClick={() => setVitalsExpanded(true)} className="text-sm font-semibold text-gray-900 truncate hover:underline">
            {medicalCase?.patientName}
          </button>
          <span className="text-xs text-gray-400">
            {medicalCase?.age}{medicalCase?.gender?.[0]?.toUpperCase()}
          </span>
          {medicalCase?.chiefComplaint && (
            <span className="text-xs text-gray-400 truncate hidden sm:inline">
              · {medicalCase.chiefComplaint.slice(0, 40)}{medicalCase.chiefComplaint.length > 40 ? '…' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className={cn(
            'text-xs font-mono font-medium',
            simTime === 0 ? 'text-gray-300' :
            simTime < 30 ? 'text-gray-500' :
            simTime < 60 ? 'text-amber-500' : 'text-red-500'
          )}>
            {simTime}m
          </span>
          <button onClick={handleConsult} disabled={isConsulting || !medicalCase} className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-30 transition-colors font-medium" aria-label="AI Consultant">
            AI
          </button>
          <button onClick={() => setIsLibraryOpen(true)} className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors" aria-label="New case">
            <RefreshCw className="w-4 h-4" />
          </button>
          {user && (
            <div className="relative">
              <button
                onClick={() => setAccountMenuOpen(p => !p)}
                className="w-6 h-6 bg-gray-900 rounded-full flex items-center justify-center text-[10px] font-medium text-white"
                aria-label="Account menu"
              >
                {user.email?.[0].toUpperCase()}
              </button>
              {accountMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setAccountMenuOpen(false)} />
                  <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-xl shadow-lg py-2 px-1 min-w-[160px] z-50">
                    <p className="px-3 py-1 text-[10px] text-gray-400 truncate">{user.email}</p>
                    <div className="border-t border-gray-100 mt-1 pt-1">
                      <button
                        onClick={() => { setAccountMenuOpen(false); handleLogout(); }}
                        className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {/* ── Abnormal vitals strip (only shows when something is wrong) ── */}
      <AnimatePresence>
        {(abnormalVitals.length > 0 || (medicalCase?.physiologicalTrend && medicalCase.physiologicalTrend !== 'stable' && medicalCase.physiologicalTrend !== 'improving')) && (
          <motion.button
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            onClick={() => setVitalsExpanded(true)}
            className={cn(
              "flex items-center justify-center gap-4 py-2 px-4 shrink-0 transition-colors cursor-pointer",
              hasCritical || medicalCase?.physiologicalTrend === 'critical' ? "bg-red-100" : "bg-amber-50"
            )}
          >
            {abnormalVitals.map((v, i) => (
              <span key={i} className={cn(
                "text-xs font-bold font-mono",
                v.critical ? "text-red-600" : "text-amber-600"
              )}>
                {v.label} {v.value}
              </span>
            ))}
            {medicalCase?.physiologicalTrend === 'declining' && (
              <span className="text-xs font-bold text-amber-600">↓ Declining</span>
            )}
            {medicalCase?.physiologicalTrend === 'critical' && (
              <span className="text-xs font-bold text-red-600 animate-pulse">⚠ Critical deterioration</span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Patient outcome overlay ── */}
      <AnimatePresence>
        {patientOutcome && patientOutcome !== 'alive' && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className={cn(
              "py-3 px-4 flex items-center justify-center gap-3 shrink-0",
              patientOutcome === 'deceased' ? "bg-gray-900 text-white" : "bg-red-600 text-white"
            )}
          >
            <span className="text-sm font-medium">
              {patientOutcome === 'deceased' ? 'Patient expired' : 'Critical deterioration'}
            </span>
            <button onClick={() => loadNewCase()} className="text-xs underline opacity-70 hover:opacity-100">
              New case
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Content area (90% of screen) ── */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-4 pb-28" role="main">
        <div className="max-w-3xl mx-auto">
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
                  setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), text: `EXAM: ${system.toUpperCase()} examined` }]);
                  reasoning.addFinding({ source: 'exam', text: `${system}: ${finding.slice(0, 60)}`, relevance: 'none', addedAt: medicalCase.simulationTime });
                  setMedicalCase(prev => {
                    if (!prev) return prev;
                    return { ...prev, clinicalActions: [...(prev.clinicalActions || []), { id: `exam-${Date.now()}`, timestamp: prev.simulationTime, type: 'exam' as const, description: `Examined ${system}: ${finding.slice(0, 80)}` }] };
                  });
                }}
              />
            )}

            {activeTab === 'labs' && medicalCase && (
              <>
                {/* CCS-style Order button */}
                <button
                  onClick={() => setOrderModalOpen(true)}
                  disabled={intervening}
                  className="w-full mb-4 py-2.5 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-40 transition-all"
                >
                  + Write Orders
                </button>
                <LabsTab key="labs" medicalCase={medicalCase} simTime={simTime} selectedLab={selectedLab} onSelectLab={setSelectedLab} onOrderLab={(name) => handleOrderTest('lab', name)} revealedStudies={revealedStudies} onRevealStudy={(type) => setRevealedStudies(prev => [...prev, type])} onOrderImaging={(name) => handleOrderTest('imaging', name)} />
              </>
            )}

            {activeTab === 'pharmacy' && (
              <>
                <button
                  onClick={() => setOrderModalOpen(true)}
                  disabled={intervening}
                  className="w-full mb-4 py-2.5 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-40 transition-all"
                >
                  + Write Orders
                </button>
                <PharmacyTab key="pharmacy" customMedInput={customMedInput} onCustomMedChange={setCustomMedInput} onAdminister={(med) => handlePerformIntervention(2, `Administer ${med}`)} intervening={intervening} medicalCase={medicalCase ?? undefined} />
              </>
            )}

            {activeTab === 'comms' && medicalCase && (
              <CommsTab key="comms" medicalCase={medicalCase} callTarget={callTarget} callMessage={callMessage} calling={calling} onSelectTarget={setCallTarget} onMessageChange={setCallMessage} onSend={handleStaffCall} />
            )}

            {activeTab === 'dxpause' && medicalCase && (
              <DxPauseTab key="dxpause" medicalCase={medicalCase} problemRepresentation={reasoning.problemRepresentation} onProblemRepresentationChange={reasoning.setProblemRepresentation} differentials={reasoning.differentials} findings={reasoning.findings} prHistory={reasoning.prHistory} prIsDirty={reasoning.prIsDirty} onUpdateFindingRelevanceForDx={reasoning.updateFindingRelevanceForDx} onSetIllnessScript={reasoning.setIllnessScript} onSetLead={reasoning.setLeadDiagnosis} simTime={simTime} onProceedToManagement={() => handleStageNavigate('management')} />
            )}

            {activeTab === 'treatment' && medicalCase && (
              <TreatmentTab key="treatment" medicalCase={medicalCase} vitalsHistory={vitalsHistory} interventionInput={interventionInput} intervening={intervening} transferExpanded={transferExpanded} simTime={simTime} onInterventionChange={setInterventionInput} onExecuteOrder={() => handlePerformIntervention()} onWait={(mins) => handlePerformIntervention(mins, 'Observe patient')} onOpenTimeAdvance={() => setTimeAdvanceOpen(true)} onTransfer={(dept) => handlePerformIntervention(0, `Transfer to ${dept}`)} onToggleTransfer={() => setTransferExpanded(p => !p)} onOrderTest={handleOrderTest} onAdvanceTime={handleAdvanceTime} onDiscontinueMedication={handleDiscontinueMedication} />
            )}

            {activeTab === 'assess' && medicalCase && (
              <AssessmentTab key="assess" medicalCase={medicalCase} simTime={simTime} userNotes={userNotes} evaluation={evaluation} submitting={submitting} logs={logs} differential={differential} onDifferentialChange={setDifferential} onNotesChange={setUserNotes} onEndCase={handleEndCase} onNewCase={() => loadNewCase()} />
            )}

            {activeTab === 'notes' && (
              <motion.div key="notes" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <ClinicalNotes />
              </motion.div>
            )}

            {activeTab === 'tools' && (
              <motion.div key="tools" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <ClinicalGuidelines />
              </motion.div>
            )}

            {activeTab === 'archive' && (
              <motion.div key="archive" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <ArchiveView user={user} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* ── Dual elapsed timer strip ── */}
      {medicalCase && (
        <div className="fixed bottom-[64px] left-0 right-0 z-30 bg-gray-50/95 border-t border-gray-100 py-1 px-4">
          <div className="max-w-md mx-auto flex items-center justify-between">
            <span className="text-[10px] font-mono text-gray-400">
              {(() => {
                const t = simTime;
                const d = Math.floor(t / 1440);
                const h = Math.floor((t % 1440) / 60);
                const m = t % 60;
                return `SIM ${d > 0 ? `${d}d ` : ''}${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m`;
              })()}
            </span>
            <span className="text-[10px] font-mono text-gray-400">
              REAL {realElapsedMins}m
            </span>
          </div>
        </div>
      )}

      {/* ── Bottom navigation: minimal dots ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-t border-gray-100">
        <div className="max-w-md mx-auto flex items-center justify-around py-3 px-4">
          {NAV_ITEMS.map(item => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className="flex flex-col items-center gap-1 group"
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
              >
                <div className={cn(
                  'w-2 h-2 rounded-full transition-all duration-200',
                  isActive ? 'w-6 bg-gray-900' : 'bg-gray-300 group-hover:bg-gray-500'
                )} />
                <span className={cn(
                  'text-[9px] font-medium transition-colors',
                  isActive ? 'text-gray-900' : 'text-gray-400'
                )}>
                  {item.label}
                </span>
              </button>
            );
          })}
          {/* More menu */}
          <div className="relative">
            <button
              onClick={() => setMoreMenuOpen(p => !p)}
              className="flex flex-col items-center gap-1 group"
              aria-label="More"
            >
              <div className={cn(
                'w-2 h-2 rounded-full transition-all duration-200',
                moreMenuOpen ? 'w-6 bg-gray-900' : 'bg-gray-300 group-hover:bg-gray-500'
              )} />
              <span className={cn(
                'text-[9px] font-medium transition-colors',
                moreMenuOpen ? 'text-gray-900' : 'text-gray-400'
              )}>
                More
              </span>
            </button>
            {moreMenuOpen && (
              <div className="absolute bottom-12 right-0 bg-white border border-gray-200 rounded-xl shadow-lg py-2 px-1 min-w-[130px] z-50">
                {[
                  { id: 'pharmacy', label: 'Pharmacy' },
                  { id: 'comms', label: 'Comms' },
                  { id: 'dxpause', label: 'DxPause' },
                  { id: 'notes', label: 'Notes' },
                  { id: 'tools', label: 'Guidelines' },
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => { setActiveTab(item.id as any); setMoreMenuOpen(false); }}
                    className={cn(
                      'w-full text-left px-3 py-1.5 text-xs rounded-lg transition-colors',
                      activeTab === item.id ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-600 hover:bg-gray-50'
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* ── Time Advance Modal ── */}
      {timeAdvanceOpen && medicalCase && (
        <TimeAdvanceModal
          medicalCase={medicalCase}
          simTime={simTime}
          intervening={intervening}
          onAdvance={handleAdvanceTime}
          onClose={() => setTimeAdvanceOpen(false)}
        />
      )}

      {/* ── Diagnosis Pad (floating, only when open) ── */}
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
              reasoning.goToStage(pendingStage);
              setActiveTab(stageToTab[pendingStage] as any);
              setPendingStage(null);
            }
            return snapId;
          }}
          onCancel={() => setPendingStage(null)}
        />
      )}

      {/* ── AI Consultant slide-over ── */}
      <AnimatePresence>
        {isConsultOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsConsultOpen(false)} className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[100]" />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 260 }} className="fixed bottom-0 left-0 right-0 max-h-[80vh] bg-white rounded-t-2xl shadow-2xl z-[101] flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">AI Consultant</h3>
                  <p className="text-[10px] text-gray-400">Specialist reasoning</p>
                </div>
                <button onClick={() => setIsConsultOpen(false)} className="p-2 hover:bg-gray-100 rounded-full" aria-label="Close"><X className="w-4 h-4 text-gray-400" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {isConsulting ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
                    <p className="text-xs text-gray-400">Thinking...</p>
                  </div>
                ) : consultantAdvice ? (
                  <>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-sm text-gray-900 leading-relaxed italic">"{consultantAdvice.advice}"</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium text-gray-400 uppercase mb-1">Reasoning</p>
                      <p className="text-sm text-gray-700 leading-relaxed">{consultantAdvice.reasoning}</p>
                    </div>
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
                  </>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-sm text-gray-400">No consultation yet</p>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
