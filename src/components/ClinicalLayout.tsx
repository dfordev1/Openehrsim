/**
 * ClinicalLayout — dark sidebar dashboard.
 * Near-black bg · left nav rail · cyan accent · monitoring-station feel.
 */

import * as Sentry from '@sentry/react';
import React, {
  Component, useCallback, useMemo, useRef, useState,
  type ErrorInfo, type ReactNode,
} from 'react';
import {
  X, RefreshCw, ChevronRight, ClipboardList, FlaskConical,
  Pill, MessageSquare, CheckCircle2, HeartPulse, ListPlus,
  Stethoscope, AlertTriangle, Clock, Activity, LayoutDashboard,
  Search, Zap, Command,
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

// ─── tokens ────────────────────────────────────────────────────────────────────
const D = {
  // surfaces
  bg:      '#0a0e1a',   // page bg
  sidebar: '#0d1117',   // sidebar
  card:    '#131929',   // card / panel
  cardHov: '#1a2235',   // card hover
  input:   '#1e2a3a',   // input bg
  // borders
  border:  '#1e2d3d',
  borderLt:'#243447',
  // text
  text:    '#e8edf5',
  textSm:  '#a8b8cc',
  muted:   '#5a7a96',
  // accent
  cyan:    '#38bdf8',
  cyanDim: '#0e3a52',
  // status
  red:     '#f87171',
  redDim:  '#3d1010',
  amber:   '#fbbf24',
  amberDim:'#3d2800',
  green:   '#34d399',
  greenDim:'#0d2e1e',
  blue:    '#818cf8',
  blueDim: '#1e1e4a',
};

type Tab = 'chart' | 'results' | 'meds' | 'consult' | 'assess';

// ─── helpers ───────────────────────────────────────────────────────────────────
function labFlag(lab: LabResult) {
  if (lab.status === 'critical') {
    const v = parseFloat(String(lab.value));
    const lo = parseFloat(lab.normalRange.split('-')[0]);
    return !isNaN(v) && !isNaN(lo) && v < lo
      ? { code: 'LL', color: D.blue }
      : { code: 'HH', color: D.red };
  }
  if (lab.status === 'abnormal') {
    const v = parseFloat(String(lab.value));
    const parts = lab.normalRange.split('-');
    const lo = parseFloat(parts[0]), hi = parseFloat(parts[parts.length - 1]);
    if (!isNaN(v) && !isNaN(lo) && !isNaN(hi))
      return v < lo ? { code: 'L', color: D.blue } : { code: 'H', color: D.amber };
    return { code: 'H', color: D.amber };
  }
  return { code: '', color: D.green };
}

const CAT_STYLE: Record<string, { color: string; bg: string }> = {
  lab:       { color: D.cyan,  bg: D.cyanDim },
  imaging:   { color: D.blue,  bg: D.blueDim },
  medication:{ color: D.green, bg: D.greenDim },
  consult:   { color: D.amber, bg: D.amberDim },
  procedure: { color: D.textSm, bg: D.input },
};

// ─── Error Boundary ─────────────────────────────────────────────────────────────
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(e: Error, i: ErrorInfo) { Sentry.captureException(e, { extra: { componentStack: i.componentStack } }); }
  render() {
    if (this.state.hasError) return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: D.bg }}>
        <div className="text-center">
          <p className="font-semibold mb-3" style={{ color: D.text }}>Application error</p>
          <button onClick={() => window.location.reload()} className="px-5 py-2 rounded-lg text-sm font-medium" style={{ background: D.cyan, color: '#000' }}>Reload</button>
        </div>
      </div>
    );
    return this.props.children;
  }
}

export { ErrorBoundary };
export function ClinicalLayout() { return <ErrorBoundary><DashShell /></ErrorBoundary>; }

// ─── CPOE search bar ────────────────────────────────────────────────────────────
function CPOEInput({
  caseId, simTime, busy,
  onExecute, onOpenTimeAdvance, onOrderTest, onOrderMedication, onConsult,
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
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);

  const search = useCallback((q: string) => {
    clearTimeout(debounce.current);
    if (!q.trim() || !caseId) { setResults([]); return; }
    debounce.current = setTimeout(async () => {
      setSearching(true);
      try { setResults((await searchOrders(caseId, q)).results.slice(0, 7)); }
      catch { setResults([]); }
      finally { setSearching(false); }
    }, 250);
  }, [caseId]);

  const clear = () => { setValue(''); setResults([]); };
  const isBusy = busy || placing;

  const execute = async () => {
    const text = value.trim();
    if (!text || isBusy) return;
    clear();
    await onExecute(text);
  };

  const place = async (r: OrderSearchResult) => {
    if (isBusy) return;
    clear();
    setPlacing(true);
    try {
      if (r.category === 'lab') await onOrderTest('lab', r.name);
      else if (r.category === 'imaging') await onOrderTest('imaging', r.name);
      else if (r.category === 'medication') await onOrderMedication(r.name, r.route, r.frequency);
      else await onExecute(`${r.category === 'consult' ? 'Consult' : 'Perform'}: ${r.name}`);
    } finally { setPlacing(false); }
  };

  const timePressure = simTime >= 90 ? D.red : simTime >= 60 ? D.amber : simTime >= 45 ? '#fb923c' : null;

  return (
    <div style={{ borderTop: `1px solid ${D.border}`, background: D.sidebar }}>
      {/* Autocomplete */}
      <AnimatePresence>
        {results.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
            style={{ borderBottom: `1px solid ${D.border}`, maxHeight: 260, overflowY: 'auto', background: D.card }}>
            {results.map(r => {
              const st = CAT_STYLE[r.category] ?? CAT_STYLE.procedure;
              return (
                <button key={r.name} onMouseDown={() => place(r)} disabled={isBusy}
                  className="w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors"
                  style={{ borderBottom: `1px solid ${D.border}` }}
                  onMouseEnter={e => (e.currentTarget.style.background = D.cardHov)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm" style={{ color: D.text }}>{r.name}</p>
                    {(r.route || r.frequency) && (
                      <p className="text-[11px] mt-0.5" style={{ color: D.muted }}>{[r.route, r.frequency].filter(Boolean).join(' · ')}</p>
                    )}
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ color: st.color, background: st.bg }}>
                    {r.category}
                  </span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input row */}
      <div className="px-4 pt-3 pb-1 flex items-center gap-3">
        <Search className="w-4 h-4 shrink-0" style={{ color: D.muted }} />
        <input
          type="text"
          value={value}
          onChange={e => { setValue(e.target.value); search(e.target.value); }}
          onKeyDown={e => {
            if (e.key === 'Enter') execute();
            if (e.key === 'Escape') clear();
          }}
          placeholder={isBusy ? 'Processing…' : 'Order, medication, or intervention…'}
          disabled={isBusy || !caseId}
          className="flex-1 bg-transparent text-sm focus:outline-none disabled:opacity-30"
          style={{ color: D.text, caretColor: D.cyan }}
          autoComplete="off"
        />
        {value.trim() && !isBusy && (
          <button onClick={execute} className="shrink-0 px-3 py-1 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80" style={{ background: D.cyan, color: '#000' }}>
            Execute
          </button>
        )}
        {!value.trim() && (
          <button onClick={onConsult} disabled={isBusy || !caseId} className="shrink-0" style={{ color: isBusy ? D.muted : D.cyan }}>
            <MessageSquare className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Sub-actions */}
      <div className="flex items-center gap-5 px-4 pb-3 pt-1">
        <button onClick={onOpenTimeAdvance} disabled={isBusy || !caseId} className="text-xs transition-colors disabled:opacity-30" style={{ color: D.muted }}
          onMouseEnter={e => (e.currentTarget.style.color = D.cyan)}
          onMouseLeave={e => (e.currentTarget.style.color = D.muted)}>
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Advance time</span>
        </button>
        {timePressure && (
          <span className="text-xs font-medium" style={{ color: timePressure }}>
            ⏱ T+{simTime}m
          </span>
        )}
        {isBusy && (
          <span className="text-xs flex items-center gap-1" style={{ color: D.cyan }}>
            <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: D.cyan }} />
            Processing…
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Dark Dashboard Shell ───────────────────────────────────────────────────────
function DashShell() {
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
  const [vitalsOpen, setVitalsOpen] = useState(false);
  const [timeAdvOpen, setTimeAdvOpen] = useState(false);
  const [imgOpen, setImgOpen] = useState<Record<string, boolean>>({});
  const [gcsState, setGcsState] = useState({ eyes: 4, verbal: 5, motor: 6 });
  const [critDismissed, setCritDismissed] = useState<Set<string>>(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile

  const mc = medicalCase;
  const isBusy = intervening || calling;

  const availLabs = useMemo(() => (mc?.labs || []).filter(l => l.availableAt !== undefined && l.availableAt <= simTime), [mc, simTime]);
  const pendLabs   = useMemo(() => (mc?.labs || []).filter(l => l.availableAt !== undefined && l.availableAt > simTime), [mc, simTime]);
  const availImgs  = useMemo(() => (mc?.imaging || []).filter(i => i.availableAt !== undefined && i.availableAt <= simTime), [mc, simTime]);
  const pendImgs   = useMemo(() => (mc?.imaging || []).filter(i => i.availableAt !== undefined && i.availableAt > simTime), [mc, simTime]);
  const activeMeds = useMemo(() => (mc?.medications || []).filter(m => m.discontinuedAt === undefined), [mc]);
  const critLabs   = useMemo(() => availLabs.filter(l => l.status === 'critical' && !critDismissed.has(l.name)), [availLabs, critDismissed]);

  const resultCount = availLabs.length + availImgs.length;
  const critCount   = availLabs.filter(l => l.status === 'critical').length;

  const sbp = mc ? parseInt(mc.vitals.bloodPressure.split('/')[0]) || 120 : 120;
  const vitalsStatus = mc ? [
    { k: 'HR',   v: mc.vitals.heartRate,         crit: mc.vitals.heartRate > 150 || mc.vitals.heartRate < 40,    abn: mc.vitals.heartRate > 100 || mc.vitals.heartRate < 60 },
    { k: 'BP',   v: mc.vitals.bloodPressure,      crit: sbp > 180 || sbp < 80,                                   abn: sbp > 140 || sbp < 90 },
    { k: 'RR',   v: mc.vitals.respiratoryRate,    crit: mc.vitals.respiratoryRate > 30 || mc.vitals.respiratoryRate < 8,  abn: mc.vitals.respiratoryRate > 20 || mc.vitals.respiratoryRate < 12 },
    { k: 'SpO₂', v: `${mc.vitals.oxygenSaturation}%`, crit: mc.vitals.oxygenSaturation < 88, abn: mc.vitals.oxygenSaturation < 95 },
    { k: 'T',    v: `${mc.vitals.temperature}°C`, crit: mc.vitals.temperature > 40 || mc.vitals.temperature < 34, abn: mc.vitals.temperature > 38.3 || mc.vitals.temperature < 36 },
  ] : [];

  // ── Auth gate ────────────────────────────────────────────────────────────────
  if (isSupabaseConfigured && !isAuthLoading && !user) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8" style={{ background: D.bg }}>
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} isRecovery={isRecovery} onRecoveryHandled={clearRecovery} />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-sm w-full">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-8" style={{ background: D.cyanDim, border: `1px solid ${D.cyan}33` }}>
          <HeartPulse className="w-8 h-8" style={{ color: D.cyan }} />
        </div>
        <h1 className="text-3xl font-bold mb-2" style={{ color: D.text }}>OpenEHR Sim</h1>
        <p className="text-sm mb-10" style={{ color: D.muted }}>Clinical decision support workstation</p>
        <button onClick={() => setIsAuthOpen(true)} className="w-full py-3 rounded-xl font-semibold text-[15px] transition-opacity hover:opacity-90" style={{ background: D.cyan, color: '#0a0e1a' }}>
          Sign In
        </button>
      </motion.div>
    </div>
  );

  if (isAuthLoading || loading || error) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: D.bg }}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
        {error ? (<>
          <AlertTriangle className="w-10 h-10 mx-auto mb-4" style={{ color: D.red }} />
          <p className="font-semibold mb-2" style={{ color: D.text }}>Connection failed</p>
          <p className="text-sm mb-6" style={{ color: D.muted }}>{error}</p>
          <button onClick={() => loadNewCase()} className="px-6 py-2.5 rounded-xl font-semibold text-sm" style={{ background: D.cyan, color: '#000' }}>Retry</button>
        </>) : (<>
          <div className="w-8 h-8 mx-auto mb-4 rounded-full border-2 animate-spin" style={{ borderColor: D.border, borderTopColor: D.cyan }} />
          <p className="text-sm" style={{ color: D.muted }}>{loadingStep || 'Loading…'}</p>
        </>)}
      </motion.div>
    </div>
  );

  const cpoeProps = {
    caseId: mc?.id,
    simTime,
    busy: isBusy,
    onExecute: (t: string) => handlePerformIntervention(5, t),
    onOpenTimeAdvance: () => setTimeAdvOpen(true),
    onOrderTest: handleOrderTest,
    onOrderMedication: handleOrderMedication,
    onConsult: handleConsult,
  } as const;

  const NAV_ITEMS: { id: Tab; icon: typeof ClipboardList; label: string; badge?: number; crit?: boolean; dot?: boolean }[] = [
    { id: 'chart',   icon: LayoutDashboard, label: 'Chart' },
    { id: 'results', icon: FlaskConical,    label: 'Results', badge: resultCount, crit: critCount > 0 },
    { id: 'meds',    icon: Pill,            label: 'Medications', badge: activeMeds.length },
    { id: 'consult', icon: MessageSquare,   label: 'Consultant', dot: isConsulting },
    { id: 'assess',  icon: CheckCircle2,    label: 'Assessment' },
  ];

  function Sidebar({ mobile = false }) {
    return (
      <div className={cn('flex flex-col h-full', mobile ? '' : 'w-56 xl:w-64')} style={{ background: D.sidebar, borderRight: `1px solid ${D.border}` }}>
        {/* Logo */}
        <div className="px-4 py-4 flex items-center gap-2.5" style={{ borderBottom: `1px solid ${D.border}` }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: D.cyanDim }}>
            <HeartPulse className="w-4 h-4" style={{ color: D.cyan }} />
          </div>
          <span className="text-sm font-semibold" style={{ color: D.text }}>OpenEHR Sim</span>
        </div>

        {/* Patient card */}
        <div className="px-3 py-3" style={{ borderBottom: `1px solid ${D.border}` }}>
          {mc ? (
            <button onClick={() => setVitalsOpen(true)} className="w-full rounded-xl p-3 text-left transition-colors" style={{ background: D.card }}
              onMouseEnter={e => (e.currentTarget.style.background = D.cardHov)}
              onMouseLeave={e => (e.currentTarget.style.background = D.card)}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: D.text }}>{mc.patientName}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: D.muted }}>{mc.age} y/o {mc.gender} · {mc.currentLocation}</p>
                </div>
                {mc.difficulty && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0" style={{ background: D.cyanDim, color: D.cyan }}>
                    {mc.difficulty.toUpperCase()}
                  </span>
                )}
              </div>
              {/* Vitals mini-grid */}
              <div className="grid grid-cols-3 gap-1">
                {vitalsStatus.slice(0, 5).map(vs => (
                  <div key={vs.k} className="rounded px-1.5 py-1" style={{ background: vs.crit ? D.redDim : vs.abn ? D.amberDim : D.input }}>
                    <p className="text-[9px] font-medium" style={{ color: D.muted }}>{vs.k}</p>
                    <p className="text-[11px] font-semibold font-mono" style={{ color: vs.crit ? D.red : vs.abn ? D.amber : D.textSm }}>{vs.v}</p>
                  </div>
                ))}
              </div>
            </button>
          ) : (
            <button onClick={() => setIsLibraryOpen(true)} className="w-full rounded-xl p-3 text-left transition-colors" style={{ background: D.card }}
              onMouseEnter={e => (e.currentTarget.style.background = D.cardHov)}
              onMouseLeave={e => (e.currentTarget.style.background = D.card)}>
              <p className="text-xs" style={{ color: D.muted }}>No patient loaded</p>
              <p className="text-xs mt-1 font-medium" style={{ color: D.cyan }}>Load case →</p>
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ id, icon: Icon, label, badge, crit, dot }) => {
            const active = tab === id;
            return (
              <button key={id} onClick={() => { setTab(id); setSidebarOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm font-medium transition-colors relative"
                style={{
                  background: active ? D.cyanDim : 'transparent',
                  color: active ? D.cyan : D.textSm,
                }}
                onMouseEnter={e => !active && (e.currentTarget.style.background = D.card)}
                onMouseLeave={e => !active && (e.currentTarget.style.background = 'transparent')}>
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1 truncate">{label}</span>
                {badge != null && badge > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center" style={{ background: crit ? D.red : D.cyan, color: crit ? '#fff' : '#000' }}>
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
                {dot && !badge && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: D.amber }} />}
              </button>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className="px-2 py-3 space-y-0.5" style={{ borderTop: `1px solid ${D.border}` }}>
          <SideBtn icon={RefreshCw} label="New Case" onClick={() => { setIsLibraryOpen(true); setSidebarOpen(false); }} />
          <SideBtn icon={Command} label="Commands" onClick={() => { setIsCommandOpen(true); setSidebarOpen(false); }} />
          {mc && <SideBtn icon={Activity} label="Dx Pad" onClick={() => setIsDxPadOpen(p => !p)} />}
          {user && (
            <button className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors"
              style={{ color: D.muted }}
              onMouseEnter={e => (e.currentTarget.style.background = D.card)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: D.cyan, color: '#000' }}>
                {user.email?.[0].toUpperCase()}
              </span>
              <span className="flex-1 truncate text-xs">{user.email}</span>
              <button onClick={handleLogout} className="text-[10px] underline ml-1" style={{ color: D.muted }}>out</button>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: D.bg, color: D.text }}>

      {/* Global overlays */}
      <CaseLibrary isOpen={isLibraryOpen} onClose={() => setIsLibraryOpen(false)} onSelectCase={(d, c, e) => { setIsLibraryOpen(false); loadNewCase(d, c, e); }} />
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} isRecovery={isRecovery} onRecoveryHandled={clearRecovery} />
      <CommandPalette isOpen={isCommandOpen} onClose={() => setIsCommandOpen(false)} onNavigate={() => {}} onNewCase={() => setIsLibraryOpen(true)} onConsult={handleConsult} hasArchive={!!user} onOrderTest={mc ? handleOrderTest : undefined} onAdminister={mc ? med => handlePerformIntervention(2, `Administer ${med}`) : undefined} onAdvanceTime={mc ? handleAdvanceTime : undefined} />
      {timeAdvOpen && mc && <TimeAdvanceModal medicalCase={mc} simTime={simTime} intervening={intervening} onAdvance={handleAdvanceTime} onClose={() => setTimeAdvOpen(false)} />}
      {vitalsOpen && <VitalsExpanded isOpen={vitalsOpen} vitalsHistory={vitalsHistory} onClose={() => setVitalsOpen(false)} />}

      {/* ── Sidebar (desktop) ── */}
      <div className="hidden md:flex md:shrink-0">
        <Sidebar />
      </div>

      {/* ── Mobile sidebar sheet ── */}
      <AnimatePresence>
        {sidebarOpen && (<>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-40 md:hidden" style={{ background: 'rgba(0,0,0,0.6)' }} />
          <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', damping: 28, stiffness: 260 }} className="fixed inset-y-0 left-0 z-50 w-64 md:hidden flex flex-col">
            <Sidebar mobile />
          </motion.div>
        </>)}
      </AnimatePresence>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Topbar */}
        <header className="h-12 flex items-center px-4 shrink-0 gap-3" style={{ borderBottom: `1px solid ${D.border}`, background: D.sidebar }}>
          {/* Mobile hamburger */}
          <button onClick={() => setSidebarOpen(true)} className="md:hidden p-1.5 rounded-lg" style={{ color: D.muted }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M3 12h18M3 6h18M3 18h18" /></svg>
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm flex-1 min-w-0">
            <span style={{ color: D.muted }}>Clinical</span>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: D.border }} />
            <span className="font-medium truncate" style={{ color: D.text }}>
              {NAV_ITEMS.find(n => n.id === tab)?.label ?? tab}
            </span>
          </div>

          {/* Right: time + patient outcome */}
          <div className="flex items-center gap-3 shrink-0">
            {mc && (
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" style={{ color: D.muted }} />
                <span className="text-xs font-mono font-semibold" style={{
                  color: simTime === 0 ? D.muted : simTime < 30 ? D.textSm : simTime < 60 ? D.amber : D.red,
                }}>T+{simTime}m</span>
              </div>
            )}
            {mc?.physiologicalTrend && mc.physiologicalTrend !== 'stable' && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{
                background: mc.physiologicalTrend === 'improving' ? D.greenDim : D.redDim,
                color: mc.physiologicalTrend === 'improving' ? D.green : D.red,
              }}>
                {mc.physiologicalTrend === 'improving' ? '↑' : '↓'} {mc.physiologicalTrend}
              </span>
            )}
            {patientOutcome && patientOutcome !== 'alive' && (
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg" style={{ background: patientOutcome === 'deceased' ? '#1a1a1a' : D.redDim, color: patientOutcome === 'deceased' ? '#ccc' : D.red }}>
                {patientOutcome === 'deceased' ? '✕ Expired' : '⚠ Deteriorating'}
                {' '}
                <button onClick={() => loadNewCase()} className="underline opacity-70 hover:opacity-100">New case</button>
              </span>
            )}
          </div>
        </header>

        {/* Critical alert */}
        <AnimatePresence>
          {critLabs.length > 0 && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="shrink-0 px-4 py-2 flex items-center gap-4 flex-wrap" style={{ background: D.redDim, borderBottom: `1px solid ${D.red}44` }}>
              <span className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: D.red }}>
                <Zap className="w-3.5 h-3.5" /> CRITICAL
              </span>
              {critLabs.slice(0, 3).map(l => (
                <span key={l.name} className="text-[12px] font-medium" style={{ color: D.red }}>
                  {l.name} <strong>{l.value}</strong> {l.unit}
                </span>
              ))}
              <div className="ml-auto flex gap-3">
                <button onClick={() => { setTab('results'); setCritDismissed(p => new Set([...p, ...critLabs.map(l => l.name)])); }} className="text-[12px] font-semibold" style={{ color: D.cyan }}>View Results →</button>
                <button onClick={() => setCritDismissed(p => new Set([...p, ...critLabs.map(l => l.name)]))} className="text-[12px]" style={{ color: D.muted }}>Dismiss</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto">

          {/* CHART */}
          {tab === 'chart' && (
            <div className="max-w-2xl mx-auto px-4 py-6">
              {mc ? (
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
                      clinicalActions: [...(prev.clinicalActions || []), { id: `exam-${Date.now()}`, timestamp: prev.simulationTime, type: 'exam' as const, description: `Examined ${system}: ${finding.slice(0, 80)}` }],
                    }) : prev);
                  }}
                  onDiscontinueMedication={handleDiscontinueMedication}
                />
              ) : (
                <DarkEmpty icon={<LayoutDashboard className="w-10 h-10" />} title="No patient loaded" sub="Select a case to begin the simulation.">
                  <button onClick={() => setIsLibraryOpen(true)} className="mt-5 px-6 py-2.5 rounded-xl font-semibold text-sm" style={{ background: D.cyan, color: '#000' }}>Browse Cases</button>
                </DarkEmpty>
              )}
            </div>
          )}

          {/* RESULTS */}
          {tab === 'results' && (
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
              {availLabs.length === 0 && pendLabs.length === 0 && availImgs.length === 0 && pendImgs.length === 0 ? (
                <DarkEmpty icon={<FlaskConical className="w-10 h-10" />} title="No results yet" sub="Order labs or imaging to see results here." />
              ) : (<>
                {(availLabs.length > 0 || pendLabs.length > 0) && (
                  <DarkCard>
                    <DarkCardHead title={`Lab Results`} badge={critCount > 0 ? { n: critCount, label: 'critical', color: D.red } : undefined} />
                    <table className="w-full border-collapse">
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${D.border}` }}>
                          {['Test', 'Result', 'Units', 'Ref Range', 'Flag', 'Available'].map(h => (
                            <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide" style={{ color: D.muted }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {availLabs.map((l, i) => {
                          const f = labFlag(l);
                          const isCrit = l.status === 'critical';
                          const isAbn  = l.status === 'abnormal';
                          return (
                            <tr key={i} style={{ borderBottom: `1px solid ${D.border}`, background: isCrit ? D.redDim + '80' : isAbn ? D.amberDim + '80' : i % 2 ? D.card + '50' : 'transparent' }}>
                              <td className="px-4 py-2.5 text-sm" style={{ color: D.text }}>{l.name}</td>
                              <td className="px-4 py-2.5 font-mono text-sm font-semibold" style={{ color: isCrit ? D.red : isAbn ? D.amber : D.text, fontSize: 14 }}>{l.value}</td>
                              <td className="px-4 py-2.5 font-mono text-xs" style={{ color: D.muted }}>{l.unit}</td>
                              <td className="px-4 py-2.5 font-mono text-xs" style={{ color: D.muted }}>{l.normalRange}</td>
                              <td className="px-4 py-2.5 text-center">
                                {f.code ? <span className="text-[11px] font-bold" style={{ color: f.color }}>{f.code}</span> : <span style={{ color: D.green }}>—</span>}
                              </td>
                              <td className="px-4 py-2.5 text-xs font-mono" style={{ color: D.muted }}>T+{l.availableAt}m</td>
                            </tr>
                          );
                        })}
                        {pendLabs.map((l, i) => (
                          <tr key={`p${i}`} style={{ borderBottom: `1px solid ${D.border}` }}>
                            <td className="px-4 py-2.5 text-sm" style={{ color: D.muted }}>{l.name}</td>
                            <td className="px-4 py-2.5" colSpan={4}>
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: D.amberDim, color: D.amber }}>
                                Pending · {Math.max(0, (l.availableAt ?? 0) - simTime)} min
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-xs font-mono" style={{ color: D.muted }}>T+{l.availableAt}m</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </DarkCard>
                )}

                {(availImgs.length > 0 || pendImgs.length > 0) && (
                  <DarkCard>
                    <DarkCardHead title="Imaging & Diagnostics" />
                    <div>
                      {availImgs.map((img, i) => (
                        <div key={i} style={{ borderBottom: `1px solid ${D.border}` }}>
                          <button onClick={() => setImgOpen(p => ({ ...p, [img.type]: !p[img.type] }))} className="w-full px-4 py-3 flex items-center justify-between text-left transition-colors"
                            onMouseEnter={e => (e.currentTarget.style.background = D.cardHov)}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                            <span className="text-sm font-medium" style={{ color: D.text }}>{img.type}</span>
                            <div className="flex items-center gap-2">
                              {img.impression && !imgOpen[img.type] && <span className="text-xs truncate max-w-xs" style={{ color: D.muted }}>{img.impression.slice(0, 60)}…</span>}
                              <ChevronRight className="w-4 h-4 transition-transform" style={{ color: D.muted, transform: imgOpen[img.type] ? 'rotate(90deg)' : undefined }} />
                            </div>
                          </button>
                          <AnimatePresence>
                            {imgOpen[img.type] && (
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                <div className="px-6 py-4 space-y-3" style={{ background: D.input }}>
                                  {img.findings && <div><p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: D.muted }}>Findings</p><p className="text-sm leading-relaxed" style={{ color: D.textSm }}>{img.findings}</p></div>}
                                  {img.impression && <div><p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: D.red }}>Impression</p><p className="text-sm leading-relaxed font-medium" style={{ color: D.text }}>{img.impression}</p></div>}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}
                      {pendImgs.map((img, i) => (
                        <div key={`pi${i}`} className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${D.border}` }}>
                          <span className="text-sm" style={{ color: D.muted }}>{img.type}</span>
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: D.amberDim, color: D.amber }}>Pending · {Math.max(0, (img.availableAt ?? 0) - simTime)} min</span>
                        </div>
                      ))}
                    </div>
                  </DarkCard>
                )}
              </>)}
            </div>
          )}

          {/* MEDS */}
          {tab === 'meds' && (
            <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
              <DarkCard>
                <DarkCardHead title={`Active Medications`} badge={activeMeds.length > 0 ? { n: activeMeds.length, label: 'active', color: D.green } : undefined} />
                {activeMeds.length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm" style={{ color: D.muted }}>No active medications.</div>
                ) : (
                  <table className="w-full border-collapse">
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${D.border}` }}>
                        {['Medication', 'Dose', 'Route', 'Started', ''].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide" style={{ color: D.muted }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {activeMeds.map((m, i) => (
                        <tr key={m.id} style={{ borderBottom: `1px solid ${D.border}`, background: i % 2 ? D.card + '50' : 'transparent' }}>
                          <td className="px-4 py-3 text-sm font-semibold" style={{ color: D.text }}>{m.name}</td>
                          <td className="px-4 py-3 text-sm" style={{ color: D.textSm }}>{m.dose}</td>
                          <td className="px-4 py-3 text-sm" style={{ color: D.textSm }}>{m.route}</td>
                          <td className="px-4 py-3 text-xs font-mono" style={{ color: D.muted }}>T+{m.timestamp}m</td>
                          <td className="px-4 py-3">
                            <button onClick={() => handleDiscontinueMedication(m.id, m.name)} className="text-xs font-semibold px-2.5 py-1 rounded-lg transition-opacity hover:opacity-80" style={{ background: D.redDim, color: D.red }}>
                              D/C
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </DarkCard>

              {(mc?.medications || []).filter(m => m.discontinuedAt !== undefined).length > 0 && (
                <DarkCard>
                  <DarkCardHead title="Discontinued" />
                  <table className="w-full border-collapse">
                    <tbody>
                      {(mc?.medications || []).filter(m => m.discontinuedAt !== undefined).map((m, i) => (
                        <tr key={m.id} style={{ borderBottom: `1px solid ${D.border}` }}>
                          <td className="px-4 py-2.5 text-sm line-through" style={{ color: D.muted }}>{m.name}</td>
                          <td className="px-4 py-2.5 text-xs" style={{ color: D.muted }}>{m.dose} {m.route}</td>
                          <td className="px-4 py-2.5 text-xs font-mono" style={{ color: D.muted }}>T+{m.timestamp}m → T+{m.discontinuedAt}m</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </DarkCard>
              )}
            </div>
          )}

          {/* CONSULT */}
          {tab === 'consult' && (
            <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
              <DarkCard>
                <DarkCardHead title="AI Consultant" action={
                  <button onClick={() => handleConsult()} disabled={isBusy || isConsulting} className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80 disabled:opacity-30" style={{ background: D.cyan, color: '#000' }}>
                    {isConsulting ? 'Consulting…' : 'Request Consult'}
                  </button>
                } />
                {isConsulting ? (
                  <div className="flex flex-col items-center py-16 gap-4">
                    <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: D.border, borderTopColor: D.cyan }} />
                    <p className="text-sm" style={{ color: D.muted }}>Awaiting response…</p>
                  </div>
                ) : consultantAdvice ? (
                  <div className="p-5 space-y-6">
                    <blockquote className="rounded-xl p-4 italic text-sm leading-relaxed" style={{ background: D.cyanDim, borderLeft: `3px solid ${D.cyan}`, color: D.text }}>
                      "{consultantAdvice.advice}"
                    </blockquote>
                    {consultantAdvice.reasoning && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: D.muted }}>Reasoning</p>
                        <p className="text-sm leading-relaxed" style={{ color: D.textSm }}>{consultantAdvice.reasoning}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide mb-3" style={{ color: D.muted }}>Recommended Actions</p>
                      <div className="space-y-3">
                        {consultantAdvice.recommendedActions.map((a, i) => (
                          <div key={i} className="flex gap-3 items-start">
                            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5" style={{ background: D.cyan, color: '#000' }}>{i + 1}</span>
                            <p className="text-sm leading-relaxed" style={{ color: D.textSm }}>{a}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <DarkEmpty icon={<MessageSquare className="w-10 h-10" />} title="No consultation yet" sub="Request an AI consult to get specialist input.">
                    <button onClick={() => handleConsult()} disabled={isBusy} className="mt-5 px-6 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-40" style={{ background: D.cyan, color: '#000' }}>
                      Request Consult
                    </button>
                  </DarkEmpty>
                )}
              </DarkCard>
            </div>
          )}

          {/* ASSESS */}
          {tab === 'assess' && (
            <div className="max-w-2xl mx-auto px-4 py-6">
              <DarkCard>
                <DarkCardHead title="Case Assessment" />
                <div className="p-5">
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
                </div>
              </DarkCard>
              {user && (
                <div className="mt-6">
                  <DarkCard>
                    <DarkCardHead title="Performance History" />
                    <div className="p-5"><ArchiveView user={user} /></div>
                  </DarkCard>
                </div>
              )}
            </div>
          )}
        </div>

        {/* CPOE */}
        {mc && <CPOEInput {...cpoeProps} />}
      </div>

      {/* Floating pads */}
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

// ─── primitives ────────────────────────────────────────────────────────────────
function SideBtn({ icon: Icon, label, onClick }: { icon: typeof RefreshCw; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors"
      style={{ color: D.muted }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = D.card; (e.currentTarget as HTMLElement).style.color = D.textSm; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = D.muted; }}>
      <Icon className="w-4 h-4 shrink-0" />
      {label}
    </button>
  );
}

function DarkCard({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl overflow-hidden" style={{ background: D.card, border: `1px solid ${D.border}` }}>{children}</div>;
}

function DarkCardHead({ title, badge, action }: { title: string; badge?: { n: number; label: string; color: string }; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${D.border}` }}>
      <div className="flex items-center gap-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: D.muted }}>{title}</span>
        {badge && badge.n > 0 && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: badge.color + '22', color: badge.color }}>{badge.n} {badge.label}</span>
        )}
      </div>
      {action}
    </div>
  );
}

function DarkEmpty({ icon, title, sub, children }: { icon: ReactNode; title: string; sub: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
      <div className="mb-4 opacity-20">{icon}</div>
      <p className="text-base font-semibold mb-1" style={{ color: D.textSm }}>{title}</p>
      <p className="text-sm leading-relaxed" style={{ color: D.muted }}>{sub}</p>
      {children}
    </div>
  );
}
