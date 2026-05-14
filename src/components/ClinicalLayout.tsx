/**
 * ClinicalLayout — Bloomberg Terminal-meets-Apple Health clinical simulator.
 * Dark-first, data-dense, cinematic. Header · Vitals Monitor · Feed · Order Bar.
 */

import * as Sentry from '@sentry/react';
import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { X, RefreshCw, Sun, Moon, LogOut, History, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { useCase } from '../contexts/CaseContext';
import { useNavigation } from '../contexts/NavigationContext';
import { useDarkMode } from '../hooks/useDarkMode';

import { AuthModal } from './Auth';
import { CaseLibrary } from './CaseLibrary';
import { CommandPalette } from './CommandPalette';
import VitalsExpanded from './VitalsExpanded';
import { VitalsMonitor } from './VitalsMonitor';
import { WorkflowStepper } from './WorkflowStepper';
import { DiagnosisPad } from './DiagnosisPad';
import { StageCommitGate } from './StageCommitGate';
import { TimeAdvanceModal } from './TimeAdvanceModal';
import { ClinicalFeed } from './ClinicalFeed';
import { OrderBar } from './OrderBar';
import { AssessmentTab } from './tabs/AssessmentTab';
import { ArchiveView } from './ArchiveView';
import { OnboardingTour } from './OnboardingTour';

// ── Error Boundary ─────────────────────────────────────────────────────────────
interface ErrorBoundaryProps { children: ReactNode; }
interface ErrorBoundaryState { hasError: boolean; }

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError(): ErrorBoundaryState { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI Crash:', error, info);
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-clinical-bg flex items-center justify-center p-8">
          <div className="max-w-sm text-center">
            <p className="text-lg font-medium text-clinical-ink mb-2">Something went wrong</p>
            <p className="text-sm text-clinical-slate mb-6">The simulator encountered an error.</p>
            <button onClick={() => window.location.reload()} className="px-6 py-2.5 bg-clinical-teal text-white rounded-full text-sm font-medium hover:opacity-90 transition-opacity">
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

// ── Main export ────────────────────────────────────────────────────────────────
export function ClinicalLayout() {
  return (
    <ErrorBoundary>
      <ClinicalLayoutInner />
    </ErrorBoundary>
  );
}

function ClinicalLayoutInner() {
  const [vitalsExpanded, setVitalsExpanded] = React.useState(false);
  const [gcsState, setGcsState] = React.useState({ eyes: 4, verbal: 5, motor: 6 });
  const [timeAdvanceOpen, setTimeAdvanceOpen] = React.useState(false);
  const [assessmentOpen, setAssessmentOpen] = React.useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = React.useState(false);
  const [isDark, toggleDarkMode] = useDarkMode();

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
    intervening,
    userNotes,
    setUserNotes,
    evaluation,
    submitting,
    differential,
    setDifferential,
    calling,
    logs,
    reasoning,
    isDxPadOpen,
    setIsDxPadOpen,
    dxPadInitialTab,
    pendingStage,
    setPendingStage,
    loadNewCase,
    handlePerformIntervention,
    handleConsult,
    handleOrderTest,
    handleOrderMedication,
    handleDiscontinueMedication,
    handleAdvanceTime,
    handleEndCase,
    handleStageNavigate,
    setMedicalCase,
    simTime,
  } = useCase();

  const { isLibraryOpen, setIsLibraryOpen, isCommandOpen, setIsCommandOpen } = useNavigation();

  // ── Auth gate ────────────────────────────────────────────────────────────────
  if (isSupabaseConfigured && !isAuthLoading && !user) {
    return (
      <div className="min-h-screen bg-clinical-bg flex flex-col items-center justify-center p-8">
        <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} isRecovery={isRecovery} onRecoveryHandled={clearRecovery} />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', damping: 20, stiffness: 200 }} className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-clinical-line" style={{ background: 'var(--clinical-surface)' }}>
            <span className="text-clinical-teal text-2xl font-black tracking-tight">Rx</span>
          </div>
          <h1 className="text-3xl font-black text-clinical-ink mb-2 uppercase tracking-tight">OpenEHR Sim</h1>
          <p className="text-sm text-clinical-slate mb-8 leading-relaxed">
            Clinical simulation engine. Sign in to begin.
          </p>
          <button onClick={() => setIsAuthOpen(true)} className="px-8 py-3 bg-clinical-teal text-white text-sm font-semibold rounded-full hover:opacity-90 transition-all glow-green">
            Sign in
          </button>
        </motion.div>
      </div>
    );
  }

  // ── Loading / error screen ───────────────────────────────────────────────────
  if (isAuthLoading || loading || error) {
    return (
      <div className="min-h-screen bg-clinical-bg flex items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', damping: 20 }} className="text-center max-w-xs">
          {error ? (
            <>
              <p className="text-base font-semibold text-clinical-ink mb-2">Connection Failed</p>
              <p className="text-sm text-clinical-slate mb-6">{error}</p>
              <button onClick={() => loadNewCase()} className="px-6 py-2.5 bg-clinical-teal text-white rounded-full text-sm font-medium hover:opacity-90 transition-all">Try Again</button>
            </>
          ) : (
            <>
              <div className="w-10 h-10 mx-auto mb-4 border-2 border-clinical-line border-t-clinical-teal rounded-full animate-spin" />
              <p className="text-sm text-clinical-slate font-mono">{loadingStep}</p>
            </>
          )}
        </motion.div>
      </div>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────────
  const hasCritical = medicalCase?.physiologicalTrend === 'critical';

  return (
    <div className={cn('h-screen flex flex-col overflow-hidden transition-colors duration-700')} style={{ background: hasCritical ? 'var(--clinical-red-soft)' : 'var(--clinical-bg)' }} role="application">

      {/* Onboarding tour */}
      <OnboardingTour />

      {/* Global modals */}
      <VitalsExpanded isOpen={vitalsExpanded} onClose={() => setVitalsExpanded(false)} vitalsHistory={vitalsHistory} />
      <CaseLibrary isOpen={isLibraryOpen} onClose={() => setIsLibraryOpen(false)} onSelectCase={(d, c, e) => { setIsLibraryOpen(false); loadNewCase(d, c, e); }} />
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} isRecovery={isRecovery} onRecoveryHandled={clearRecovery} />
      <CommandPalette
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        onNavigate={() => {}}
        onNewCase={() => setIsLibraryOpen(true)}
        onConsult={handleConsult}
        hasArchive={!!user}
        onOrderTest={medicalCase ? handleOrderTest : undefined}
        onAdminister={medicalCase ? (med) => handlePerformIntervention(2, `Administer ${med}`) : undefined}
        onAdvanceTime={medicalCase ? handleAdvanceTime : undefined}
      />
      {timeAdvanceOpen && medicalCase && (
        <TimeAdvanceModal
          medicalCase={medicalCase}
          simTime={simTime}
          intervening={intervening}
          onAdvance={handleAdvanceTime}
          onClose={() => setTimeAdvanceOpen(false)}
        />
      )}

      {/* ── Header ── */}
      <header className="h-12 flex items-center px-4 shrink-0 relative z-30 border-b border-clinical-line" style={{ background: 'var(--clinical-surface)' }}>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Brand mark */}
          <div className="w-6 h-6 rounded-md flex items-center justify-center border border-clinical-line shrink-0" style={{ background: 'var(--clinical-surface-raised)' }}>
            <span className="text-clinical-teal text-[9px] font-black">Rx</span>
          </div>
          <button onClick={() => setVitalsExpanded(true)} className="text-sm font-semibold text-clinical-ink truncate hover:text-clinical-teal transition-colors">
            {medicalCase?.patientName}
          </button>
          <span className="text-xs text-clinical-slate">
            {medicalCase?.age}{medicalCase?.gender?.[0]?.toUpperCase()}
          </span>
          {medicalCase?.chiefComplaint && (
            <span className="text-xs text-clinical-slate/60 truncate hidden sm:inline">
              · {medicalCase.chiefComplaint.slice(0, 50)}{medicalCase.chiefComplaint.length > 50 ? '…' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Dark/light toggle */}
          <button
            onClick={toggleDarkMode}
            className="p-1.5 text-clinical-slate hover:text-clinical-ink transition-colors rounded-lg hover:bg-clinical-line/50"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => setIsLibraryOpen(true)} className="p-1.5 text-clinical-slate hover:text-clinical-ink transition-colors rounded-lg hover:bg-clinical-line/50" aria-label="New case">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          {user ? (
            <div className="relative">
              <button onClick={() => setAccountMenuOpen(p => !p)} className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border border-clinical-line text-clinical-ink" style={{ background: 'var(--clinical-surface-raised)' }} aria-label="Account menu">
                {user.email?.[0].toUpperCase()}
              </button>
              {accountMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setAccountMenuOpen(false)} />
                  <div className="absolute right-0 top-8 rounded-xl shadow-2xl py-2 px-1 min-w-[180px] z-50 border border-clinical-line" style={{ background: 'var(--clinical-surface)' }}>
                    <p className="px-3 py-1 text-[10px] text-clinical-slate truncate">{user.email}</p>
                    <div className="border-t border-clinical-line mt-1 pt-1">
                      <button onClick={() => { setAccountMenuOpen(false); setAssessmentOpen(true); }} className="w-full text-left px-3 py-1.5 text-xs text-clinical-ink hover:bg-clinical-line/50 rounded-lg transition-colors flex items-center gap-2">
                        <History className="w-3 h-3" /> History & score
                      </button>
                      <button onClick={() => { setAccountMenuOpen(false); handleLogout(); }} className="w-full text-left px-3 py-1.5 text-xs text-clinical-red hover:bg-clinical-red-soft rounded-lg transition-colors flex items-center gap-2">
                        <LogOut className="w-3 h-3" /> Sign out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </div>
      </header>

      {/* ── Vitals Monitor + Stage Stepper ── */}
      {medicalCase && (
        <div className="px-3 sm:px-4 pt-2 pb-1 shrink-0 space-y-2">
          <VitalsMonitor
            vitals={medicalCase.vitals}
            trend={medicalCase.physiologicalTrend}
            simTime={simTime}
            onExpand={() => setVitalsExpanded(true)}
          />
          <WorkflowStepper
            currentStage={reasoning.currentStage}
            commitments={reasoning.stageCommitments}
            onNavigate={handleStageNavigate}
          />
        </div>
      )}

      {/* Patient outcome banner */}
      <AnimatePresence>
        {patientOutcome && patientOutcome !== 'alive' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', damping: 20 }}
            className={cn(
              'py-3 px-4 flex items-center justify-center gap-3 shrink-0 mx-3 sm:mx-4 rounded-xl',
              patientOutcome === 'deceased' ? 'bg-clinical-red/20 border border-clinical-red/30 text-clinical-red' : 'bg-clinical-amber/20 border border-clinical-amber/30 text-clinical-amber'
            )}
          >
            <span className="text-sm font-semibold">{patientOutcome === 'deceased' ? 'Patient expired' : 'Critical deterioration'}</span>
            <button onClick={() => loadNewCase()} className="text-xs underline opacity-70 hover:opacity-100 transition-opacity">New case</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Scrollable feed ── */}
      <main className="flex-1 overflow-y-auto px-3 sm:px-4 pb-48" role="main">
        <div className="max-w-2xl mx-auto">
          {medicalCase && (
            <ClinicalFeed
              medicalCase={medicalCase}
              simTime={simTime}
              intervening={intervening}
              gcsState={gcsState}
              onGcsChange={(cat, score) => setGcsState(prev => ({ ...prev, [cat]: score }))}
              onExamineSystem={(system, finding) => {
                reasoning.addFinding({ source: 'exam', text: `${system}: ${finding.slice(0, 60)}`, relevance: 'none', addedAt: medicalCase.simulationTime });
                setMedicalCase(prev => {
                  if (!prev) return prev;
                  return { ...prev, clinicalActions: [...(prev.clinicalActions || []), { id: `exam-${Date.now()}`, timestamp: prev.simulationTime, type: 'exam' as const, description: `Examined ${system}: ${finding.slice(0, 80)}` }] };
                });
              }}
              onDiscontinueMedication={handleDiscontinueMedication}
            />
          )}
        </div>
      </main>

      {/* ── Sticky order bar ── */}
      <OrderBar
        medicalCase={medicalCase}
        simTime={simTime}
        intervening={intervening || calling}
        onOpenTimeAdvance={() => setTimeAdvanceOpen(true)}
        onTransfer={(dept) => handlePerformIntervention(0, `Transfer to ${dept}`)}
        onOrderTest={handleOrderTest}
        onOrderMedication={handleOrderMedication}
        onPerformIntervention={handlePerformIntervention}
        onOpenAssessment={() => setAssessmentOpen(true)}
        onConsult={handleConsult}
      />

      {/* ── Assessment overlay (End case) ── */}
      <AnimatePresence>
        {assessmentOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 24, stiffness: 260 }}
            className="fixed inset-0 bg-clinical-bg z-50 overflow-y-auto"
          >
            <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
              <button onClick={() => setAssessmentOpen(false)} className="text-sm text-clinical-slate hover:text-clinical-ink transition-colors mb-6 flex items-center gap-1">
                <ChevronRight className="w-3 h-3 rotate-180" /> Back to case
              </button>
              <AssessmentTab
                medicalCase={medicalCase}
                simTime={simTime}
                userNotes={userNotes}
                evaluation={evaluation}
                submitting={submitting}
                logs={logs}
                differential={differential}
                onDifferentialChange={setDifferential}
                onNotesChange={setUserNotes}
                onEndCase={handleEndCase}
                onNewCase={() => { setAssessmentOpen(false); loadNewCase(); }}
              />
              {user && (
                <div className="mt-12 border-t border-clinical-line pt-8">
                  <ArchiveView user={user} />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Diagnosis Pad (floating) ── */}
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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsConsultOpen(false)} className="fixed inset-0 z-[100]" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="fixed bottom-0 left-0 right-0 max-h-[80vh] rounded-t-2xl shadow-2xl z-[101] flex flex-col overflow-hidden border-t border-clinical-line"
              style={{ background: 'var(--clinical-surface)' }}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-clinical-line">
                <div>
                  <h3 className="text-sm font-semibold text-clinical-ink">AI Consultant</h3>
                  <p className="text-[10px] text-clinical-slate">Specialist reasoning</p>
                </div>
                <button onClick={() => setIsConsultOpen(false)} className="p-2 hover:bg-clinical-line/50 rounded-full transition-colors" aria-label="Close"><X className="w-4 h-4 text-clinical-slate" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {isConsulting ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <div className="w-6 h-6 border-2 border-clinical-line border-t-clinical-teal rounded-full animate-spin" />
                    <p className="text-xs text-clinical-slate font-mono">Thinking...</p>
                  </div>
                ) : consultantAdvice ? (
                  <>
                    <div className="rounded-xl p-4 border border-clinical-line" style={{ background: 'var(--clinical-surface-raised)' }}>
                      <p className="text-sm text-clinical-ink leading-relaxed italic">"{consultantAdvice.advice}"</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-clinical-slate uppercase tracking-widest mb-1">Reasoning</p>
                      <p className="text-sm text-clinical-ink-muted leading-relaxed">{consultantAdvice.reasoning}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-clinical-slate uppercase tracking-widest mb-2">Next steps</p>
                      <div className="space-y-2">
                        {consultantAdvice.recommendedActions.map((action, i) => (
                          <div key={i} className="flex items-start gap-3">
                            <span className="w-5 h-5 rounded-full bg-clinical-teal text-white flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</span>
                            <p className="text-sm text-clinical-ink pt-0.5">{action}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-sm text-clinical-slate">No consultation yet</p>
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
