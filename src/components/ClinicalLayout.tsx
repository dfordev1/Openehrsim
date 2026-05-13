/**
 * ClinicalLayout — the full UI shell, extracted from App.tsx.
 * Consumes AuthContext, CaseContext, and NavigationContext.
 */

import * as Sentry from '@sentry/react';
import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import {
  AlertCircle,
  Brain,
  Loader2,
  Menu,
  Moon,
  RefreshCw,
  Sparkles,
  Sun,
  Undo2,
  X,
  Zap,
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
import { ClinicalVital } from './ClinicalVital';
import { NavTab } from './NavTab';
import { CaseLibrary } from './CaseLibrary';
import { CommandPalette } from './CommandPalette';
import { SkeletonCard, SkeletonVitals } from './Skeleton';
import { EmptyState } from './EmptyState';
import VitalsExpanded from './VitalsExpanded';
import { DiagnosisPad } from './DiagnosisPad';
import { StageCommitGate } from './StageCommitGate';
import { ReasoningNudges } from './ReasoningNudges';
import { WorkflowProgress } from './WorkflowProgress';
import { OnboardingTour } from './OnboardingTour';
import { ArchiveView } from './ArchiveView';

// Tab components
import { HpiTab } from './tabs/HpiTab';
import { ExamTab } from './tabs/ExamTab';
import { LabsTab } from './tabs/LabsTab';
import { ImagingTab } from './tabs/ImagingTab';
import { PharmacyTab } from './tabs/PharmacyTab';
import { TreatmentTab } from './tabs/TreatmentTab';
import { CommsTab } from './tabs/CommsTab';
import { AssessmentTab } from './tabs/AssessmentTab';
import { TriageTab } from './tabs/TriageTab';
import { DxPauseTab } from './tabs/DxPauseTab';

import type { WorkflowStage } from '../types';
import { STAGE_ORDER } from '../hooks/useClinicalReasoning';



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

export { ErrorBoundary };



// ── ClinicalLayout ────────────────────────────────────────────────────────────
export function ClinicalLayout() {
  return (
    <ErrorBoundary>
      <ClinicalLayoutInner />
    </ErrorBoundary>
  );
}

function ClinicalLayoutInner() {
  // ── Consume contexts ────────────────────────────────────────────────────────
  const { user, isAuthOpen, setIsAuthOpen, isSupabaseConfigured, handleLogout } = useAuth();
  const {
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
  } = useCase();
  const {
    activeTab,
    setActiveTab,
    isSidebarOpen,
    setIsSidebarOpen,
    isLibraryOpen,
    setIsLibraryOpen,
    isCommandOpen,
    setIsCommandOpen,
    isDark,
    toggleDark,
    primaryTabs,
    actionTabs,
    toolTabs,
    mobileNavTabs,
  } = useNavigation();

  /** Map workflow stages to the tab ids used by activeTab. */
  const stageToTab: Record<WorkflowStage, string> = {
    triage: 'triage',
    history: 'hpi',
    exam: 'exam',
    diagnostics: 'labs',
    dxpause: 'dxpause',
    management: 'treatment',
  };



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

      <CaseLibrary isOpen={isLibraryOpen} onClose={() => setIsLibraryOpen(false)} onSelectCase={(d, c, e) => { setIsLibraryOpen(false); loadNewCase(d, c, e); }} />
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
      <header className="h-10 bg-clinical-surface border-b border-clinical-line/50 flex items-center px-3 shrink-0 z-30" role="banner">
        <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-1 hover:bg-clinical-bg rounded mr-2" aria-label="Menu">
          <Menu className="w-4 h-4 text-clinical-slate" />
        </button>
        <span className="text-xs font-medium text-clinical-ink truncate">{medicalCase?.patientName || 'OpenEHR'}</span>
        <div className="flex items-center gap-2 ml-auto">
          <span className={cn(
            'text-[11px] font-mono px-1.5 py-0.5 rounded font-medium',
            simTime === 0 ? 'text-clinical-slate/50' :
            simTime < 30  ? 'text-clinical-green' :
            simTime < 60  ? 'text-clinical-amber' :
                            'text-clinical-red'
          )} title="Simulation elapsed time">
            T+{simTime}m
          </span>
          <button onClick={toggleDark} className="p-1 hover:bg-clinical-bg rounded transition-colors" aria-label={isDark ? 'Light mode' : 'Dark mode'}>
            {isDark ? <Sun className="w-3.5 h-3.5 text-clinical-slate/60" /> : <Moon className="w-3.5 h-3.5 text-clinical-slate/60" />}
          </button>
          <button onClick={() => setIsLibraryOpen(true)} className="p-1 text-clinical-slate/60 hover:text-clinical-blue transition-colors" aria-label="New case">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          {user ? (
            <button onClick={handleLogout} className="w-5 h-5 bg-clinical-blue/80 rounded-full flex items-center justify-center text-[9px] font-medium text-white" aria-label="Account">
              {user.email?.[0].toUpperCase()}
            </button>
          ) : (
            <button onClick={() => setIsAuthOpen(true)} className="text-[11px] text-clinical-blue font-medium hover:underline" aria-label="Sign in">Sign in</button>
          )}
        </div>
      </header>



      {/* ── Patient Outcome Banner ── */}
      <AnimatePresence>
        {patientOutcome && patientOutcome !== 'alive' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className={cn('border-b py-1.5 px-3 flex items-center gap-2 shrink-0', patientOutcome === 'deceased' ? 'bg-gray-800 border-gray-700' : 'bg-red-900/70 border-red-700')}
            role="alert" aria-live="assertive"
          >
            <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', patientOutcome === 'deceased' ? 'bg-gray-400' : 'bg-red-400')} />
            <span className={cn('text-[11px] font-medium', patientOutcome === 'deceased' ? 'text-gray-200' : 'text-red-200')}>
              {patientOutcome === 'deceased' ? 'Patient Expired — Submit diagnosis or start new case' : 'Critical Deterioration — Immediate escalation required'}
            </span>
            <button onClick={() => loadNewCase()} className="ml-auto text-[10px] font-medium underline text-white/60 hover:text-white/90">New Case</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Alarm Banner ── */}
      <AnimatePresence>
        {(medicalCase?.activeAlarms || []).length > 0 && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-red-50/40 border-b border-red-100/60 py-1 px-3 flex items-center gap-2 overflow-hidden shrink-0" role="alert" aria-live="assertive">
            <div className="w-1 h-1 bg-clinical-red/50 rounded-full shrink-0" />
            <div className="flex gap-2 text-[10px] text-clinical-red/70 font-medium overflow-x-auto no-scrollbar">
              {medicalCase?.activeAlarms.map((a, i) => <span key={i}>{a}</span>)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Clinical Reasoning Workflow Progress ── */}
      {medicalCase && (
        <div className="bg-clinical-surface border-b border-clinical-line/50 px-3 py-1.5 shrink-0">
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
            setTimeout(() => setDxPadInitialTab(undefined), 100);
          }}
        />
      )}

      {/* ── Vitals Rail ── */}
      <div className="h-9 bg-clinical-surface border-b border-clinical-line/50 flex items-center px-3 gap-2 shrink-0 overflow-x-auto no-scrollbar" role="region" aria-label="Vital signs">
        <ClinicalVital label="HR"   value={Math.round(vitalsHistory[vitalsHistory.length-1]?.hr || medicalCase?.vitals?.heartRate || 0)} unit="bpm"  status="normal" isAlarming={medicalCase?.activeAlarms.some(a => /HR|Pulse|Brady|Tachy/i.test(a))} onClick={() => setVitalsExpanded(true)} />
        <ClinicalVital label="BP"   value={medicalCase?.vitals?.bloodPressure || '--'}           unit="mmHg" status="normal" isAlarming={medicalCase?.activeAlarms.some(a => /BP|Pressure|Hypotension|Hypertension/i.test(a))} onClick={() => setVitalsExpanded(true)} />
        <ClinicalVital label="SpO2" value={medicalCase?.vitals?.oxygenSaturation || 0}          unit="%"    status="normal" isAlarming={medicalCase?.activeAlarms.some(a => /SpO2|Saturation|Hypoxia/i.test(a))} onClick={() => setVitalsExpanded(true)} />
        <ClinicalVital label="RR"   value={medicalCase?.vitals?.respiratoryRate || '--'}         unit="/min" status="normal" isAlarming={medicalCase?.activeAlarms.some(a => /RR|Respiratory/i.test(a))} onClick={() => setVitalsExpanded(true)} />
        <ClinicalVital label="Temp" value={medicalCase?.vitals?.temperature || 0}               unit="°C"   status="normal" isAlarming={medicalCase?.activeAlarms.some(a => /Temp|Temperature|Fever/i.test(a))} onClick={() => setVitalsExpanded(true)} />
      </div>



      <div className="flex flex-1 overflow-hidden relative">

        {/* ── Mobile sidebar drawer ── */}
        <AnimatePresence>
          {isSidebarOpen && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-clinical-ink/40 backdrop-blur-sm z-[100] lg:hidden" aria-hidden="true" />
              <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed top-0 left-0 bottom-0 w-56 bg-clinical-surface border-r border-clinical-line z-[101] lg:hidden flex flex-col" role="dialog" aria-modal="true" aria-label="Navigation menu">
                <div className="flex items-center justify-between p-3 border-b border-clinical-line">
                  <span className="text-xs font-semibold tracking-tight">OpenEHR</span>
                  <button onClick={() => setIsSidebarOpen(false)} className="p-1 hover:bg-clinical-bg rounded" aria-label="Close navigation">
                    <X className="w-4 h-4 text-clinical-slate" />
                  </button>
                </div>
                <nav className="flex-1 overflow-y-auto p-2 space-y-3" aria-label="Main navigation">
                  {[{ label: 'Patient Data', tabs: primaryTabs }, { label: 'Actions', tabs: actionTabs }, { label: 'Tools', tabs: toolTabs }].map(({ label, tabs }) => (
                    <div key={label}>
                      <p className="text-[9px] font-semibold text-clinical-slate/50 uppercase tracking-wider px-2.5 mb-0.5">{label}</p>
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
        <nav className="w-44 bg-clinical-surface border-r border-clinical-line/50 flex-col py-2 px-1.5 z-20 shrink-0 hidden lg:flex" aria-label="Main navigation">
          <div className="space-y-3 flex-1">
            {[{ label: 'Patient Data', tabs: primaryTabs }, { label: 'Actions', tabs: actionTabs }, { label: 'Tools', tabs: toolTabs }].map(({ label, tabs }) => (
              <div key={label}>
                <p className="text-[9px] font-semibold text-clinical-slate/50 uppercase tracking-wider px-2.5 mb-0.5">{label}</p>
                <div className="space-y-0.5">
                  {tabs.map(tab => (
                    <NavTab key={tab.id} active={activeTab === tab.id} icon={tab.icon} label={tab.label} onClick={() => setActiveTab(tab.id as any)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="pt-2 px-1 border-t border-clinical-line/50">
            <button onClick={handleConsult} disabled={isConsulting || !medicalCase} className="w-full py-1.5 px-2.5 text-[11px] font-medium text-clinical-slate hover:text-clinical-blue hover:bg-clinical-blue/5 rounded transition-colors flex items-center gap-2 disabled:opacity-40" aria-label="AI Consultant">
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
