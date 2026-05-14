/**
 * ClinicalLayout — iOS-native aesthetic.
 * F2F2F7 grouped bg · inset-grouped white cards · 007AFF accent
 * Bottom tab bar · translucent nav bar · bottom-sheet modals · pill vitals
 */

import * as Sentry from '@sentry/react';
import React, {
  Component, useCallback, useEffect, useMemo, useRef, useState,
  type ErrorInfo, type ReactNode,
} from 'react';
import {
  X, RefreshCw, ChevronRight, ClipboardList, FlaskConical,
  Pill, MessageCircle, CheckCircle, HeartPulse, ListPlus,
  Stethoscope, AlertCircle,
} from 'lucide-react';
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
import type { OrderSearchResult, LabResult } from '../types';

// ─── design tokens ─────────────────────────────────────────────────────────────
// iOS semantic colours (used in inline styles where Tailwind JIT can't see them)
const IOS = {
  bg:          '#F2F2F7',  // grouped background
  card:        '#FFFFFF',
  separator:   'rgba(60,60,67,0.18)',
  blue:        '#007AFF',
  green:       '#34C759',
  red:         '#FF3B30',
  orange:      '#FF9500',
  yellow:      '#FFCC00',
  gray:        '#8E8E93',
  label:       '#000000',
  secondLabel: '#3C3C43',
  navBar:      'rgba(249,249,249,0.94)',
  tabBar:      'rgba(249,249,249,0.94)',
};

// ─── helpers ──────────────────────────────────────────────────────────────────
function labFlag(lab: LabResult) {
  if (lab.status === 'critical') {
    const v = parseFloat(String(lab.value));
    const parts = lab.normalRange.split('-');
    const lo = parseFloat(parts[0]);
    return !isNaN(v) && !isNaN(lo) && v < lo
      ? { code: 'LL', color: IOS.blue }
      : { code: 'HH', color: IOS.red };
  }
  if (lab.status === 'abnormal') {
    const v = parseFloat(String(lab.value));
    const parts = lab.normalRange.split('-');
    const lo = parseFloat(parts[0]), hi = parseFloat(parts[parts.length - 1]);
    if (!isNaN(v) && !isNaN(lo) && !isNaN(hi))
      return v < lo ? { code: 'L', color: IOS.blue } : { code: 'H', color: IOS.orange };
    return { code: 'H', color: IOS.orange };
  }
  return { code: '', color: IOS.green };
}

type Tab = 'chart' | 'results' | 'meds' | 'consult' | 'assess';

// ─── Error Boundary ────────────────────────────────────────────────────────────
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(e: Error, i: ErrorInfo) { Sentry.captureException(e, { extra: { componentStack: i.componentStack } }); }
  render() {
    if (this.state.hasError) return (
      <div className="min-h-screen flex items-center justify-center p-8" style={{ background: IOS.bg }}>
        <div className="text-center">
          <p className="text-base font-semibold mb-2">Something went wrong</p>
          <button onClick={() => window.location.reload()} className="text-sm rounded-full px-5 py-2 text-white" style={{ background: IOS.blue }}>Reload</button>
        </div>
      </div>
    );
    return this.props.children;
  }
}

export { ErrorBoundary };
export function ClinicalLayout() { return <ErrorBoundary><IOSShell /></ErrorBoundary>; }

// ─── Order search bar (iMessage-style CPOE) ────────────────────────────────────
const CATEGORY_COLOR: Record<string, { text: string; bg: string }> = {
  lab:       { text: IOS.blue,   bg: '#E8F0FE' },
  imaging:   { text: '#7C3AED',  bg: '#F5F3FF' },
  medication:{ text: IOS.green,  bg: '#E8FFF0' },
  consult:   { text: IOS.orange, bg: '#FFF4E5' },
  procedure: { text: IOS.gray,   bg: '#F2F2F7' },
};

function CPOEBar({
  caseId, simTime, busy,
  onExecute, onOpenTimeAdvance,
  onOrderTest, onOrderMedication, onConsult,
}: {
  caseId: string | undefined;
  simTime: number;
  busy: boolean;
  onExecute: (text: string) => Promise<void>;
  onOpenTimeAdvance: () => void;
  onOrderTest: (type: 'lab' | 'imaging', name: string) => Promise<void>;
  onOrderMedication: (name: string, route?: string, freq?: string) => Promise<void>;
  onConsult: () => void;
}) {
  const [value, setValue] = useState('');
  const [results, setResults] = useState<OrderSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [placing, setPlacing] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const search = useCallback((q: string) => {
    clearTimeout(debounceRef.current);
    if (!q.trim() || !caseId) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try { setResults((await searchOrders(caseId, q)).results.slice(0, 6)); }
      catch { setResults([]); }
      finally { setSearching(false); }
    }, 260);
  }, [caseId]);

  const clear = () => { setValue(''); setResults([]); };

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

  return (
    <div className="border-t" style={{ borderColor: IOS.separator, background: IOS.navBar, backdropFilter: 'blur(20px)' }}>
      {/* Suggestions list */}
      <AnimatePresence>
        {results.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
            className="max-h-56 overflow-y-auto" style={{ borderBottom: `1px solid ${IOS.separator}` }}>
            {results.map(r => {
              const col = CATEGORY_COLOR[r.category] ?? CATEGORY_COLOR.procedure;
              return (
                <button key={r.name} onMouseDown={() => place(r)} disabled={isBusy}
                  className="w-full text-left px-4 py-3 flex items-center gap-3 active:bg-gray-100 transition-colors"
                  style={{ borderBottom: `1px solid ${IOS.separator}` }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-black">{r.name}</p>
                    {(r.route || r.frequency) && <p className="text-[11px] mt-0.5" style={{ color: IOS.gray }}>{[r.route, r.frequency].filter(Boolean).join(' · ')}</p>}
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ color: col.text, background: col.bg }}>
                    {r.category}
                  </span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input row */}
      <div className="px-4 pt-2 pb-1 flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 rounded-full px-3 py-2 text-sm" style={{ background: 'rgba(120,120,128,0.12)' }}>
          <input
            type="text"
            value={value}
            onChange={e => { setValue(e.target.value); search(e.target.value); }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); execute(); }
              if (e.key === 'Escape') clear();
            }}
            placeholder={isBusy ? 'Processing…' : searching ? 'Searching…' : 'Order, medication, or intervention…'}
            disabled={isBusy || !caseId}
            className="flex-1 bg-transparent focus:outline-none text-sm disabled:opacity-40"
            style={{ color: IOS.label }}
            autoComplete="off"
          />
          {value.trim() && !isBusy && (
            <button onClick={clear} className="shrink-0 -mr-1">
              <X className="w-3.5 h-3.5" style={{ color: IOS.gray }} />
            </button>
          )}
        </div>
        {value.trim() && !isBusy ? (
          <button onClick={execute} className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: IOS.blue }}>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-white"><path d="M2 21L23 12 2 3v7l15 2-15 2z" /></svg>
          </button>
        ) : (
          <button onClick={onConsult} disabled={isBusy || !caseId} className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-30" style={{ background: IOS.blue }}>
            <MessageCircle className="w-4 h-4 text-white" />
          </button>
        )}
      </div>

      {/* Quick actions */}
      <div className="flex items-center gap-5 px-4 pb-2.5 pt-1">
        <button onClick={onOpenTimeAdvance} disabled={isBusy || !caseId} className="text-xs font-medium disabled:opacity-30" style={{ color: IOS.blue }}>Advance time</button>
        <span className="text-xs font-medium" style={{ color: isBusy ? IOS.orange : IOS.gray }}>
          {isBusy ? '● Processing…' : `T+${simTime}m`}
        </span>
      </div>
    </div>
  );
}

// ─── iOS Shell ──────────────────────────────────────────────────────────────────
function IOSShell() {
  const {
    user, isAuthOpen, setIsAuthOpen, handleLogout,
    isSupabaseConfigured, isAuthLoading, isRecovery, clearRecovery,
  } = useAuth();

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

  const [tab, setTab] = useState<Tab>('chart');
  const [vitalsExpanded, setVitalsExpanded] = useState(false);
  const [timeAdvanceOpen, setTimeAdvanceOpen] = useState(false);
  const [imgOpen, setImgOpen] = useState<Record<string, boolean>>({});
  const [gcsState, setGcsState] = useState({ eyes: 4, verbal: 5, motor: 6 });
  const [critDismissed, setCritDismissed] = useState<Set<string>>(new Set());

  const mc = medicalCase;
  const isBusy = intervening || calling;

  const availLabs = useMemo(() =>
    (mc?.labs || []).filter(l => l.availableAt !== undefined && l.availableAt <= simTime),
    [mc, simTime]);
  const pendLabs = useMemo(() =>
    (mc?.labs || []).filter(l => l.availableAt !== undefined && l.availableAt > simTime),
    [mc, simTime]);
  const availImgs = useMemo(() =>
    (mc?.imaging || []).filter(i => i.availableAt !== undefined && i.availableAt <= simTime),
    [mc, simTime]);
  const pendImgs = useMemo(() =>
    (mc?.imaging || []).filter(i => i.availableAt !== undefined && i.availableAt > simTime),
    [mc, simTime]);
  const activeMeds = useMemo(() => (mc?.medications || []).filter(m => m.discontinuedAt === undefined), [mc]);
  const critLabs = useMemo(() => availLabs.filter(l => l.status === 'critical' && !critDismissed.has(l.name)), [availLabs, critDismissed]);

  const resultsBadge = availLabs.length + availImgs.length;
  const critCount = availLabs.filter(l => l.status === 'critical').length;

  // Vitals abnormalities for alert strip
  const abnVitals: { label: string; value: string; crit: boolean }[] = [];
  if (mc?.vitals) {
    const v = mc.vitals;
    if (v.heartRate > 120 || v.heartRate < 50) abnVitals.push({ label: 'HR', value: `${v.heartRate}`, crit: v.heartRate > 150 || v.heartRate < 40 });
    if (v.oxygenSaturation < 94) abnVitals.push({ label: 'SpO₂', value: `${v.oxygenSaturation}%`, crit: v.oxygenSaturation < 88 });
    const sbp = parseInt(mc.vitals.bloodPressure.split('/')[0]) || 120;
    if (sbp < 90 || sbp > 160) abnVitals.push({ label: 'BP', value: mc.vitals.bloodPressure, crit: sbp < 80 || sbp > 180 });
    if (v.respiratoryRate > 24 || v.respiratoryRate < 10) abnVitals.push({ label: 'RR', value: `${v.respiratoryRate}`, crit: v.respiratoryRate > 30 || v.respiratoryRate < 8 });
    if (v.temperature > 38.5 || v.temperature < 36) abnVitals.push({ label: 'T', value: `${v.temperature}°`, crit: v.temperature > 40 || v.temperature < 34 });
  }
  const hasCritical = abnVitals.some(v => v.crit) || mc?.physiologicalTrend === 'critical';

  // ── Auth gate ──────────────────────────────────────────────────────────────
  if (isSupabaseConfigured && !isAuthLoading && !user) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8" style={{ background: IOS.bg }}>
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} isRecovery={isRecovery} onRecoveryHandled={clearRecovery} />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-[22px] flex items-center justify-center mx-auto mb-6 shadow-lg" style={{ background: IOS.blue }}>
          <HeartPulse className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ color: IOS.label }}>OpenEHR Sim</h1>
        <p className="text-[15px] mb-10" style={{ color: IOS.gray }}>USMLE Step 3 CCS simulator</p>
        <button onClick={() => setIsAuthOpen(true)} className="w-full py-3 rounded-xl text-[17px] font-semibold text-white" style={{ background: IOS.blue }}>
          Sign In
        </button>
      </motion.div>
    </div>
  );

  if (isAuthLoading || loading || error) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: IOS.bg }}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
        {error ? (<>
          <AlertCircle className="w-10 h-10 mx-auto mb-4" style={{ color: IOS.red }} />
          <p className="text-base font-semibold mb-1">Unable to Connect</p>
          <p className="text-sm mb-6" style={{ color: IOS.gray }}>{error}</p>
          <button onClick={() => loadNewCase()} className="px-6 py-2.5 rounded-xl text-white text-sm font-semibold" style={{ background: IOS.blue }}>Try Again</button>
        </>) : (<>
          <div className="w-8 h-8 mx-auto mb-4 border-2 border-gray-200 rounded-full animate-spin" style={{ borderTopColor: IOS.blue }} />
          <p className="text-sm" style={{ color: IOS.gray }}>{loadingStep || 'Loading…'}</p>
        </>)}
      </motion.div>
    </div>
  );

  const cpoeProps = {
    caseId: mc?.id,
    simTime,
    busy: isBusy,
    onExecute: (text: string) => handlePerformIntervention(5, text),
    onOpenTimeAdvance: () => setTimeAdvanceOpen(true),
    onOrderTest: handleOrderTest,
    onOrderMedication: handleOrderMedication,
    onConsult: handleConsult,
  } as const;

  return (
    <div className="h-screen flex flex-col" style={{ background: IOS.bg }}>

      {/* ── Global overlays ── */}
      <CaseLibrary isOpen={isLibraryOpen} onClose={() => setIsLibraryOpen(false)} onSelectCase={(d, c, e) => { setIsLibraryOpen(false); loadNewCase(d, c, e); }} />
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} isRecovery={isRecovery} onRecoveryHandled={clearRecovery} />
      <CommandPalette isOpen={isCommandOpen} onClose={() => setIsCommandOpen(false)} onNavigate={() => {}} onNewCase={() => setIsLibraryOpen(true)} onConsult={handleConsult} hasArchive={!!user} onOrderTest={mc ? handleOrderTest : undefined} onAdminister={mc ? med => handlePerformIntervention(2, `Administer ${med}`) : undefined} onAdvanceTime={mc ? handleAdvanceTime : undefined} />
      {timeAdvanceOpen && mc && <TimeAdvanceModal medicalCase={mc} simTime={simTime} intervening={intervening} onAdvance={handleAdvanceTime} onClose={() => setTimeAdvanceOpen(false)} />}
      {vitalsExpanded && <VitalsExpanded isOpen={vitalsExpanded} vitalsHistory={vitalsHistory} onClose={() => setVitalsExpanded(false)} />}

      {/* ── Navigation bar ── */}
      <header className="shrink-0 z-30" style={{ background: IOS.navBar, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: `1px solid ${IOS.separator}` }}>
        {/* Title row */}
        <div className="h-11 flex items-center px-4">
          <button onClick={() => setIsLibraryOpen(true)} className="flex items-center gap-1 text-sm font-medium" style={{ color: IOS.blue }}>
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Cases</span>
          </button>
          <div className="flex-1 text-center">
            <span className="text-[17px] font-semibold truncate" style={{ color: IOS.label }}>
              {mc?.patientName ?? 'OpenEHR Sim'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-medium" style={{ color: simTime === 0 ? IOS.gray : simTime < 30 ? IOS.gray : simTime < 60 ? IOS.orange : IOS.red }}>
              {simTime > 0 ? `T+${simTime}m` : ''}
            </span>
            {user && (
              <button onClick={handleLogout} className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white" style={{ background: IOS.blue }}>
                {user.email?.[0].toUpperCase()}
              </button>
            )}
          </div>
        </div>

        {/* Patient subtitle row */}
        {mc && (
          <button onClick={() => setVitalsExpanded(true)} className="w-full flex items-center gap-2 px-4 pb-2.5 text-left">
            <span className="text-[13px]" style={{ color: IOS.gray }}>
              {mc.age} y/o {mc.gender}
            </span>
            {mc.difficulty && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: IOS.blue + '18', color: IOS.blue }}>
                {mc.difficulty}
              </span>
            )}
            {/* Vitals pills */}
            <div className="flex items-center gap-1.5 flex-wrap ml-auto">
              {[
                { label: 'HR', value: mc.vitals.heartRate, crit: mc.vitals.heartRate > 150 || mc.vitals.heartRate < 40, abn: mc.vitals.heartRate > 100 || mc.vitals.heartRate < 60 },
                { label: 'BP', value: mc.vitals.bloodPressure, crit: false, abn: false },
                { label: 'SpO₂', value: `${mc.vitals.oxygenSaturation}%`, crit: mc.vitals.oxygenSaturation < 88, abn: mc.vitals.oxygenSaturation < 95 },
                { label: 'T', value: `${mc.vitals.temperature}°`, crit: mc.vitals.temperature > 40 || mc.vitals.temperature < 34, abn: mc.vitals.temperature > 38.3 || mc.vitals.temperature < 36 },
              ].map(({ label, value, crit, abn }) => (
                <span key={label} className="text-[11px] font-medium px-1.5 py-0.5 rounded" style={{
                  background: crit ? IOS.red + '18' : abn ? IOS.orange + '18' : 'rgba(120,120,128,0.12)',
                  color: crit ? IOS.red : abn ? IOS.orange : IOS.gray,
                }}>
                  {label} {value}
                </span>
              ))}
            </div>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: IOS.gray }} />
          </button>
        )}
      </header>

      {/* ── Critical result banner ── */}
      <AnimatePresence>
        {critLabs.length > 0 && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="shrink-0 px-4 py-2 flex items-center gap-3 flex-wrap" style={{ background: IOS.red + '18' }}>
            <span className="text-[11px] font-bold" style={{ color: IOS.red }}>CRITICAL</span>
            {critLabs.slice(0, 3).map(l => (
              <span key={l.name} className="text-[11px] font-medium" style={{ color: IOS.red }}>
                {l.name} {l.value}{l.unit}
              </span>
            ))}
            <div className="ml-auto flex gap-3">
              <button onClick={() => { setTab('results'); setCritDismissed(p => new Set([...p, ...critLabs.map(l => l.name)])); }} className="text-[12px] font-semibold" style={{ color: IOS.blue }}>View →</button>
              <button onClick={() => setCritDismissed(p => new Set([...p, ...critLabs.map(l => l.name)]))} className="text-[12px]" style={{ color: IOS.gray }}>Dismiss</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Patient outcome ── */}
      <AnimatePresence>
        {patientOutcome && patientOutcome !== 'alive' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="shrink-0 py-2.5 px-4 flex items-center justify-center gap-3"
            style={{ background: patientOutcome === 'deceased' ? '#1C1C1E' : IOS.red }}>
            <span className="text-sm font-semibold text-white">{patientOutcome === 'deceased' ? 'Patient Expired' : 'Critical Deterioration'}</span>
            <button onClick={() => loadNewCase()} className="text-sm text-white/70 underline">New Case</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">

        {/* CHART */}
        {tab === 'chart' && (
          <div className="pb-4 pt-2">
            {mc ? (
              <div className="max-w-2xl mx-auto px-4">
                <ClinicalTimeline
                  medicalCase={mc}
                  simTime={simTime}
                  intervening={intervening}
                  gcsState={gcsState}
                  onGcsChange={(cat, score) => setGcsState(prev => ({ ...prev, [cat]: score }))}
                  onExamineSystem={(system, finding) => {
                    reasoning.addFinding({ source: 'exam', text: `${system}: ${finding.slice(0, 60)}`, relevance: 'none', addedAt: mc.simulationTime });
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
              </div>
            ) : (
              <IOSEmptyState icon={<ClipboardList className="w-10 h-10" style={{ color: IOS.gray }} />} title="No Patient Loaded" sub="Select a case from the library.">
                <button onClick={() => setIsLibraryOpen(true)} className="mt-4 px-6 py-2.5 rounded-xl text-white text-sm font-semibold" style={{ background: IOS.blue }}>Browse Cases</button>
              </IOSEmptyState>
            )}
          </div>
        )}

        {/* RESULTS */}
        {tab === 'results' && (
          <div className="pt-4 pb-4">
            {availLabs.length === 0 && pendLabs.length === 0 && availImgs.length === 0 && pendImgs.length === 0 ? (
              <IOSEmptyState icon={<FlaskConical className="w-10 h-10" style={{ color: IOS.gray }} />} title="No Results" sub="Order labs or imaging to see results here." />
            ) : (
              <div className="space-y-0">
                {/* Labs */}
                {(availLabs.length > 0 || pendLabs.length > 0) && (
                  <IOSSection label={`Laboratory Results${critCount > 0 ? ` — ${critCount} critical` : ''}`} labelColor={critCount > 0 ? IOS.red : undefined}>
                    {availLabs.map((l, i) => {
                      const f = labFlag(l);
                      const isCrit = l.status === 'critical';
                      const isAbn  = l.status === 'abnormal';
                      return (
                        <IOSRow key={i} style={{ background: isCrit ? IOS.red + '0A' : isAbn ? IOS.orange + '0A' : IOS.card }}>
                          <div className="flex-1 min-w-0">
                            <p className="text-[15px]" style={{ color: IOS.label }}>{l.name}</p>
                            <p className="text-[12px] mt-0.5" style={{ color: IOS.gray }}>{l.normalRange} {l.unit}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[17px] font-semibold font-mono" style={{ color: isCrit ? IOS.red : isAbn ? IOS.orange : IOS.label }}>
                              {l.value}
                            </span>
                            <span className="text-[11px] font-mono" style={{ color: IOS.gray }}>{l.unit}</span>
                            {f.code && (
                              <span className="text-[11px] font-bold w-7 text-center" style={{ color: f.color }}>{f.code}</span>
                            )}
                          </div>
                        </IOSRow>
                      );
                    })}
                    {pendLabs.map((l, i) => (
                      <IOSRow key={`p${i}`} style={{ background: IOS.card }}>
                        <div className="flex-1 min-w-0">
                          <p className="text-[15px]" style={{ color: IOS.gray }}>{l.name}</p>
                          <p className="text-[12px] mt-0.5" style={{ color: IOS.gray }}>Pending · ETA T+{l.availableAt}m</p>
                        </div>
                        <span className="text-[13px] font-medium px-2.5 py-1 rounded-full" style={{ background: IOS.orange + '18', color: IOS.orange }}>
                          {Math.max(0, (l.availableAt ?? 0) - simTime)}m
                        </span>
                      </IOSRow>
                    ))}
                  </IOSSection>
                )}

                {/* Imaging */}
                {(availImgs.length > 0 || pendImgs.length > 0) && (
                  <IOSSection label="Imaging & Diagnostics">
                    {availImgs.map((img, i) => (
                      <div key={i}>
                        <button onClick={() => setImgOpen(p => ({ ...p, [img.type]: !p[img.type] }))} className="w-full" style={{ borderBottom: !imgOpen[img.type] ? `1px solid ${IOS.separator}` : undefined }}>
                          <IOSRow>
                            <div className="flex-1 text-left">
                              <p className="text-[15px]" style={{ color: IOS.label }}>{img.type}</p>
                              {img.impression && !imgOpen[img.type] && (
                                <p className="text-[12px] mt-0.5 truncate" style={{ color: IOS.gray }}>{img.impression}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[12px]" style={{ color: IOS.blue }}>{imgOpen[img.type] ? 'Less' : 'More'}</span>
                              <ChevronRight className="w-4 h-4 transition-transform" style={{ color: IOS.gray, transform: imgOpen[img.type] ? 'rotate(90deg)' : undefined }} />
                            </div>
                          </IOSRow>
                        </button>
                        <AnimatePresence>
                          {imgOpen[img.type] && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden px-4 py-3 space-y-2 text-sm border-b" style={{ background: '#FAFAFA', borderColor: IOS.separator }}>
                              {img.findings && <p className="text-[13px] leading-relaxed" style={{ color: IOS.secondLabel }}><span className="font-semibold text-[11px] uppercase tracking-wide" style={{ color: IOS.gray }}>Findings</span><br />{img.findings}</p>}
                              {img.impression && <p className="text-[13px] leading-relaxed font-medium" style={{ color: IOS.label }}><span className="font-semibold text-[11px] uppercase tracking-wide" style={{ color: IOS.red }}>Impression</span><br />{img.impression}</p>}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}
                    {pendImgs.map((img, i) => (
                      <IOSRow key={`pi${i}`} style={{ background: IOS.card }}>
                        <div className="flex-1">
                          <p className="text-[15px]" style={{ color: IOS.gray }}>{img.type}</p>
                          <p className="text-[12px] mt-0.5" style={{ color: IOS.gray }}>Pending · ETA T+{img.availableAt}m</p>
                        </div>
                        <span className="text-[13px] font-medium px-2.5 py-1 rounded-full" style={{ background: IOS.orange + '18', color: IOS.orange }}>
                          {Math.max(0, (img.availableAt ?? 0) - simTime)}m
                        </span>
                      </IOSRow>
                    ))}
                  </IOSSection>
                )}
              </div>
            )}
          </div>
        )}

        {/* MEDS */}
        {tab === 'meds' && (
          <div className="pt-4 pb-4">
            {activeMeds.length === 0 ? (
              <IOSEmptyState icon={<Pill className="w-10 h-10" style={{ color: IOS.gray }} />} title="No Active Medications" sub="Order medications to see them here." />
            ) : (
              <IOSSection label={`Active Medications (${activeMeds.length})`}>
                {activeMeds.map((m, i) => (
                  <IOSRow key={m.id}>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-medium" style={{ color: IOS.label }}>{m.name}</p>
                      <p className="text-[12px] mt-0.5" style={{ color: IOS.gray }}>{m.dose} · {m.route}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[12px] font-mono" style={{ color: IOS.gray }}>T+{m.timestamp}m</span>
                      <button onClick={() => handleDiscontinueMedication(m.id, m.name)} className="text-[13px] font-semibold" style={{ color: IOS.red }}>D/C</button>
                    </div>
                  </IOSRow>
                ))}
              </IOSSection>
            )}
            {(mc?.medications || []).filter(m => m.discontinuedAt !== undefined).length > 0 && (
              <IOSSection label="Discontinued">
                {(mc?.medications || []).filter(m => m.discontinuedAt !== undefined).map((m, i) => (
                  <IOSRow key={m.id}>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] line-through" style={{ color: IOS.gray }}>{m.name}</p>
                      <p className="text-[12px] mt-0.5" style={{ color: IOS.gray }}>{m.dose} · T+{m.timestamp}m → T+{m.discontinuedAt}m</p>
                    </div>
                  </IOSRow>
                ))}
              </IOSSection>
            )}
          </div>
        )}

        {/* CONSULT */}
        {tab === 'consult' && (
          <div className="pt-4 pb-4">
            {isConsulting ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-8 h-8 border-2 border-gray-200 rounded-full animate-spin" style={{ borderTopColor: IOS.blue }} />
                <p className="text-sm" style={{ color: IOS.gray }}>Consulting…</p>
              </div>
            ) : consultantAdvice ? (
              <div className="space-y-0">
                <IOSSection label="Consultant Advice">
                  <div className="px-4 py-4">
                    <p className="text-[15px] leading-relaxed italic" style={{ color: IOS.label }}>"{consultantAdvice.advice}"</p>
                  </div>
                </IOSSection>
                {consultantAdvice.reasoning && (
                  <IOSSection label="Reasoning">
                    <div className="px-4 py-4">
                      <p className="text-[15px] leading-relaxed" style={{ color: IOS.secondLabel }}>{consultantAdvice.reasoning}</p>
                    </div>
                  </IOSSection>
                )}
                <IOSSection label="Recommended Actions">
                  {consultantAdvice.recommendedActions.map((action, i) => (
                    <IOSRow key={i}>
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0" style={{ background: IOS.blue }}>{i + 1}</span>
                      <p className="flex-1 text-[15px] leading-relaxed" style={{ color: IOS.label }}>{action}</p>
                    </IOSRow>
                  ))}
                </IOSSection>
                <div className="px-4 pt-3">
                  <button onClick={() => handleConsult()} disabled={isBusy} className="w-full py-3.5 rounded-2xl text-[17px] font-semibold text-white disabled:opacity-40" style={{ background: IOS.blue }}>
                    Request New Consult
                  </button>
                </div>
              </div>
            ) : (
              <IOSEmptyState icon={<MessageCircle className="w-10 h-10" style={{ color: IOS.gray }} />} title="No Consultation Yet" sub="Request an AI consult to get specialist input.">
                <button onClick={() => handleConsult()} disabled={isBusy} className="mt-5 px-8 py-3 rounded-xl text-white text-[15px] font-semibold disabled:opacity-40" style={{ background: IOS.blue }}>
                  Request Consult
                </button>
              </IOSEmptyState>
            )}
          </div>
        )}

        {/* ASSESS */}
        {tab === 'assess' && (
          <div className="pt-4 pb-8 px-4">
            <div className="max-w-xl mx-auto">
              <AssessmentTab
                medicalCase={mc}
                simTime={simTime}
                userNotes={userNotes}
                evaluation={evaluation}
                submitting={submitting}
                logs={logs}
                differential={differential}
                onDifferentialChange={setDifferential}
                onNotesChange={setUserNotes}
                onEndCase={handleEndCase}
                onNewCase={() => { setTab('chart'); loadNewCase(); }}
              />
              {user && (
                <div className="mt-10 border-t pt-8" style={{ borderColor: IOS.separator }}>
                  <ArchiveView user={user} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── CPOE input ── */}
      {mc && <CPOEBar {...cpoeProps} />}

      {/* ── Tab bar ── */}
      <nav className="shrink-0 safe-area-inset-bottom" style={{ background: IOS.tabBar, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderTop: `1px solid ${IOS.separator}` }}>
        <div className="flex h-[49px]">
          {([
            { id: 'chart',   icon: ClipboardList, label: 'Chart',   badge: 0,             badgeCrit: false, dot: false },
            { id: 'results', icon: FlaskConical,  label: 'Results', badge: resultsBadge, badgeCrit: critCount > 0, dot: false },
            { id: 'meds',    icon: Pill,          label: 'Meds',    badge: activeMeds.length, badgeCrit: false, dot: false },
            { id: 'consult', icon: MessageCircle, label: 'Consult', badge: 0,             badgeCrit: false, dot: isConsulting },
            { id: 'assess',  icon: CheckCircle,   label: 'Assess',  badge: 0,             badgeCrit: false, dot: false },
          ] as const).map(({ id, icon: Icon, label, badge, badgeCrit, dot }) => {
            const active = tab === id;
            const col = active ? IOS.blue : IOS.gray;
            return (
              <button key={id} onClick={() => setTab(id as Tab)} className="flex-1 flex flex-col items-center justify-center gap-0.5 relative">
                <div className="relative">
                  <Icon className="w-[25px] h-[25px]" style={{ color: col }} strokeWidth={active ? 2 : 1.5} />
                  {badge > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-0.5 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: badgeCrit ? IOS.red : IOS.blue }}>
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                  {dot && !badge && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full" style={{ background: IOS.orange }} />}
                </div>
                <span className="text-[10px]" style={{ color: col, fontWeight: active ? 600 : 400 }}>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── Floating pads ── */}
      {mc && (
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

      {mc && pendingStage && (
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
    </div>
  );
}

// ─── iOS layout primitives ─────────────────────────────────────────────────────
function IOSSection({ label, children, labelColor }: { label: string; children: ReactNode; labelColor?: string }) {
  return (
    <div className="px-4 mb-6">
      <p className="text-[13px] font-medium px-1 mb-2 uppercase tracking-wide" style={{ color: labelColor ?? IOS.gray }}>
        {label}
      </p>
      <div className="rounded-2xl overflow-hidden" style={{ background: IOS.card }}>
        {children}
      </div>
    </div>
  );
}

function IOSRow({ children, style, onClick }: { children: ReactNode; style?: React.CSSProperties; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={cn('flex items-center gap-3 px-4 py-3', onClick && 'cursor-pointer active:bg-gray-50')}
      style={{ borderBottom: `1px solid ${IOS.separator}`, ...style }}
    >
      {children}
    </div>
  );
}

function IOSEmptyState({ icon, title, sub, children }: { icon: ReactNode; title: string; sub: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
      <div className="mb-4 opacity-40">{icon}</div>
      <p className="text-[17px] font-semibold mb-1" style={{ color: IOS.label }}>{title}</p>
      <p className="text-[15px] leading-relaxed" style={{ color: IOS.gray }}>{sub}</p>
      {children}
    </div>
  );
}
