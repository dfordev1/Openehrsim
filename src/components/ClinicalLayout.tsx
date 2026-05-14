/**
 * ClinicalLayout — Epic EHR pixel-perfect clone.
 * Dark teal nav · patient header band · vitals sparklines
 * 4-panel content grid · patient list sidebar · orders panel
 */

import * as Sentry from '@sentry/react';
import React, {
  Component, useCallback, useEffect, useMemo, useRef, useState,
  type ErrorInfo, type ReactNode,
} from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { useCase } from '../contexts/CaseContext';
import { useNavigation } from '../contexts/NavigationContext';
import { searchOrders } from '../services/geminiService';
import { AuthModal } from './Auth';
import { CaseLibrary } from './CaseLibrary';
import { CommandPalette } from './CommandPalette';
import { DiagnosisPad } from './DiagnosisPad';
import { StageCommitGate } from './StageCommitGate';
import { TimeAdvanceModal } from './TimeAdvanceModal';
import { AssessmentTab } from './tabs/AssessmentTab';
import { ArchiveView } from './ArchiveView';
import type { OrderSearchResult, LabResult } from '../types';
import type { VitalsHistoryEntry } from '../hooks/useVitalsPoll';

// ─── Epic colour palette ───────────────────────────────────────────────────────
const E = {
  teal:      '#1b5e6e',   // top-nav + patient header bg
  tealDark:  '#144d5c',   // hover state
  tealLight: '#e8f4f7',   // selected row tint
  tabBar:    '#dce8ed',   // secondary nav bg
  tabActive: '#ffffff',
  bodyBg:    '#f0f3f5',   // page background
  panel:     '#ffffff',
  panelHead: '#e8ecef',   // section header bg
  border:    '#cdd6dd',
  borderDk:  '#b0bec5',
  text:      '#1a2b35',
  textSm:    '#3a5060',
  muted:     '#6b8fa3',
  red:       '#c0392b',
  redLt:     '#fdf0ef',
  amber:     '#d97706',
  amberLt:   '#fffbeb',
  green:     '#1a7a3c',
  greenLt:   '#edf9f1',
  blue:      '#1565c0',
  blueLt:    '#e8f0fe',
  font:      '"Segoe UI", Arial, Helvetica, sans-serif',
  mono:      '"Consolas", "Courier New", monospace',
};

// ─── Error boundary ────────────────────────────────────────────────────────────
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(e: Error, i: ErrorInfo) { Sentry.captureException(e, { extra: { componentStack: i.componentStack } }); }
  render() {
    if (this.state.hasError) return (
      <div style={{ padding: 40, fontFamily: E.font, fontSize: 13 }}>
        <strong>Application Error</strong>
        <button onClick={() => window.location.reload()} style={{ marginLeft: 16, padding: '4px 12px' }}>Reload</button>
      </div>
    );
    return this.props.children;
  }
}

export { ErrorBoundary };
export function ClinicalLayout() { return <ErrorBoundary><EpicShell /></ErrorBoundary>; }

// ─── Sparkline ────────────────────────────────────────────────────────────────
function Sparkline({ values, color, width = 80, height = 30 }: { values: number[]; color: string; width?: number; height?: number }) {
  if (values.length < 2) return <svg width={width} height={height} />;
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (width - 4) + 2;
    const y = height - 4 - ((v - min) / range) * (height - 8);
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      {/* last point dot */}
      {(() => {
        const last = values[values.length - 1];
        const x = width - 2;
        const y = height - 4 - ((last - min) / range) * (height - 8);
        return <circle cx={x} cy={y} r={2.5} fill={color} />;
      })()}
    </svg>
  );
}

// ─── Vitals analysis ──────────────────────────────────────────────────────────
function vitalStatus(key: string, val: number): 'critical' | 'abnormal' | 'normal' {
  if (key === 'hr')   return val > 150 || val < 40 ? 'critical' : val > 100 || val < 60 ? 'abnormal' : 'normal';
  if (key === 'sbp')  return val < 80 || val > 180 ? 'critical' : val < 90 || val > 160 ? 'abnormal' : 'normal';
  if (key === 'spo2') return val < 88 ? 'critical' : val < 94 ? 'abnormal' : 'normal';
  if (key === 'rr')   return val > 30 || val < 8 ? 'critical' : val > 20 || val < 12 ? 'abnormal' : 'normal';
  if (key === 'temp') return val > 40 || val < 34 ? 'critical' : val > 38.3 || val < 36 ? 'abnormal' : 'normal';
  return 'normal';
}

function statusColor(s: 'critical' | 'abnormal' | 'normal') {
  return s === 'critical' ? E.red : s === 'abnormal' ? E.amber : E.text;
}

function labFlagInfo(lab: LabResult) {
  if (lab.status === 'critical') {
    const v = parseFloat(String(lab.value));
    const lo = parseFloat(lab.normalRange.split('-')[0]);
    return { code: !isNaN(v) && !isNaN(lo) && v < lo ? 'LL' : 'HH', color: E.red, bg: E.redLt };
  }
  if (lab.status === 'abnormal') {
    const v = parseFloat(String(lab.value));
    const parts = lab.normalRange.split('-');
    const lo = parseFloat(parts[0]), hi = parseFloat(parts[parts.length - 1]);
    if (!isNaN(v) && !isNaN(lo) && !isNaN(hi))
      return v < lo ? { code: 'L', color: E.blue, bg: E.blueLt } : { code: 'H', color: E.amber, bg: E.amberLt };
    return { code: 'H', color: E.amber, bg: E.amberLt };
  }
  return { code: '', color: E.green, bg: 'transparent' };
}

const ACTION_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  medication:    { bg: '#fff3e0', color: '#e65100', label: 'Rx'    },
  order:         { bg: E.blueLt,  color: E.blue,    label: 'Ord'   },
  exam:          { bg: '#f3e5f5', color: '#7b1fa2',  label: 'Exam'  },
  procedure:     { bg: E.amberLt, color: E.amber,    label: 'Proc'  },
  communication: { bg: E.tealLight, color: E.teal,   label: 'Comm'  },
  'time-advance':{ bg: E.panelHead, color: E.muted,  label: 'Time'  },
};

// ─── CPOE search bar ──────────────────────────────────────────────────────────
function CPOEBar({ caseId, simTime, busy, onExecute, onOpenTimeAdvance, onOrderTest, onOrderMedication, onConsult }: {
  caseId: string | undefined; simTime: number; busy: boolean;
  onExecute: (t: string) => Promise<void>; onOpenTimeAdvance: () => void;
  onOrderTest: (type: 'lab' | 'imaging', n: string) => Promise<void>;
  onOrderMedication: (n: string, r?: string, f?: string) => Promise<void>;
  onConsult: () => void;
}) {
  const [val, setVal] = useState('');
  const [res, setRes] = useState<OrderSearchResult[]>([]);
  const [placing, setPlacing] = useState(false);
  const deb = useRef<ReturnType<typeof setTimeout>>(undefined);

  const search = useCallback((q: string) => {
    clearTimeout(deb.current);
    if (!q.trim() || !caseId) { setRes([]); return; }
    deb.current = setTimeout(async () => {
      try { setRes((await searchOrders(caseId, q)).results.slice(0, 7)); } catch { setRes([]); }
    }, 250);
  }, [caseId]);

  const clear = () => { setVal(''); setRes([]); };
  const isBusy = busy || placing;

  const execute = async () => {
    const t = val.trim(); if (!t || isBusy) return;
    clear(); await onExecute(t);
  };
  const place = async (r: OrderSearchResult) => {
    if (isBusy) return; clear(); setPlacing(true);
    try {
      if (r.category === 'lab') await onOrderTest('lab', r.name);
      else if (r.category === 'imaging') await onOrderTest('imaging', r.name);
      else if (r.category === 'medication') await onOrderMedication(r.name, r.route, r.frequency);
      else await onExecute(`${r.category === 'consult' ? 'Consult' : 'Perform'}: ${r.name}`);
    } finally { setPlacing(false); }
  };

  return (
    <div style={{ background: E.panelHead, borderTop: `1px solid ${E.border}`, fontFamily: E.font }}>
      <AnimatePresence>
        {res.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
            style={{ background: E.panel, borderBottom: `1px solid ${E.border}`, maxHeight: 240, overflowY: 'auto' }}>
            {res.map(r => {
              const catColors: Record<string, { bg: string; color: string }> = {
                lab: { bg: E.blueLt, color: E.blue }, imaging: { bg: '#f3e5f5', color: '#7b1fa2' },
                medication: { bg: '#fff3e0', color: '#e65100' }, consult: { bg: E.amberLt, color: E.amber },
                procedure: { bg: E.panelHead, color: E.muted },
              };
              const cc = catColors[r.category] ?? catColors.procedure;
              return (
                <button key={r.name} onMouseDown={() => place(r)} disabled={isBusy}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '5px 12px', background: 'none', border: 'none', borderBottom: `1px solid ${E.border}`, cursor: 'pointer', textAlign: 'left', fontFamily: E.font, fontSize: 12 }}
                  onMouseEnter={e => (e.currentTarget.style.background = E.tealLight)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                  <span style={{ flex: 1, color: E.text }}>{r.name}</span>
                  {(r.route || r.frequency) && <span style={{ color: E.muted, fontSize: 10 }}>{[r.route, r.frequency].filter(Boolean).join(' · ')}</span>}
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 10, background: cc.bg, color: cc.color }}>{r.category}</span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: E.teal, letterSpacing: 0.5 }}>CPOE</span>
        <input
          type="text" value={val}
          onChange={e => { setVal(e.target.value); search(e.target.value); }}
          onKeyDown={e => { if (e.key === 'Enter') execute(); if (e.key === 'Escape') clear(); }}
          onBlur={() => setTimeout(() => setRes([]), 150)}
          placeholder={isBusy ? 'Processing…' : 'Order, medication, procedure, or free text…'}
          disabled={isBusy || !caseId}
          style={{ flex: 1, padding: '4px 8px', fontSize: 12, border: `1px solid ${E.border}`, background: isBusy ? '#f5f5f5' : '#fff', fontFamily: E.font, outline: 'none' }}
        />
        <select disabled style={{ fontSize: 11, padding: '4px 6px', border: `1px solid ${E.border}`, background: '#fff' }}>
          <option>STAT</option><option>Routine</option>
        </select>
        <button onClick={execute} disabled={isBusy || !val.trim()} style={{ padding: '4px 14px', fontSize: 12, background: E.teal, color: '#fff', border: 'none', cursor: 'pointer', fontFamily: E.font }}>
          Accept
        </button>
        <div style={{ width: 1, height: 18, background: E.border, margin: '0 4px' }} />
        <button onClick={onOpenTimeAdvance} disabled={isBusy || !caseId} style={{ fontSize: 11, color: E.teal, background: 'none', border: `1px solid ${E.border}`, padding: '3px 8px', cursor: 'pointer', fontFamily: E.font }}>
          ↻ Advance Time
        </button>
        <button onClick={onConsult} disabled={isBusy || !caseId} style={{ fontSize: 11, color: E.teal, background: 'none', border: `1px solid ${E.border}`, padding: '3px 8px', cursor: 'pointer', fontFamily: E.font }}>
          Consult
        </button>
        {simTime > 0 && <span style={{ fontSize: 11, fontFamily: E.mono, color: simTime >= 60 ? E.red : simTime >= 30 ? E.amber : E.muted }}>T+{simTime}m</span>}
      </div>
    </div>
  );
}

// ─── Mock patient list (sidebar) ──────────────────────────────────────────────
const MOCK_PATIENTS = [
  { name: 'Cruz, Patricia',    age: '62F', status: 'critical', room: '3A-01' },
  { name: 'Alvarez, Jonathan', age: '45M', status: 'stable',   room: '3A-02' },
  { name: 'Garcia, Michael',   age: '71M', status: 'abnormal', room: '3A-03' },
  { name: 'Thompson, Sarah',   age: '38F', status: 'stable',   room: '3A-04' },
  { name: 'Wilson, David',     age: '55M', status: 'abnormal', room: '3A-05' },
  { name: 'Martinez, Elena',   age: '49F', status: 'stable',   room: 'ICU-1' },
  { name: 'Brown, James',      age: '67M', status: 'critical', room: 'ICU-2' },
  { name: 'Lee, Michelle',     age: '52F', status: 'stable',   room: '3C-01' },
  { name: 'Davis, Robert',     age: '44M', status: 'stable',   room: '3C-02' },
];

// ─── Epic Shell ───────────────────────────────────────────────────────────────
function EpicShell() {
  const {
    user, isAuthOpen, setIsAuthOpen, handleLogout,
    isSupabaseConfigured, isAuthLoading, isRecovery, clearRecovery,
  } = useAuth();

  const {
    medicalCase: mc, loading, error, loadingStep, patientOutcome, vitalsHistory,
    consultantAdvice, isConsulting,
    intervening, calling, userNotes, setUserNotes, evaluation, submitting,
    differential, setDifferential, logs, reasoning,
    isDxPadOpen, setIsDxPadOpen, dxPadInitialTab,
    pendingStage, setPendingStage,
    loadNewCase, handlePerformIntervention, handleConsult,
    handleOrderTest, handleOrderMedication, handleDiscontinueMedication,
    handleAdvanceTime, handleEndCase, setMedicalCase, simTime,
  } = useCase();

  const { isLibraryOpen, setIsLibraryOpen, isCommandOpen, setIsCommandOpen } = useNavigation();

  const [activeChartTab, setActiveChartTab] = useState('chart');
  const [activeTimelineTab, setActiveTimelineTab] = useState<'all' | 'events' | 'orders' | 'results'>('all');
  const [activeOrderTab, setActiveOrderTab] = useState<'active' | 'recent'>('active');
  const [imgOpen, setImgOpen]   = useState<Record<string, boolean>>({});
  const [assessOpen, setAssessOpen] = useState(false);
  const [timeAdvOpen, setTimeAdvOpen] = useState(false);
  const [selectedPt, setSelectedPt] = useState<string | null>(null);

  const availLabs = useMemo(() => (mc?.labs || []).filter(l => l.availableAt !== undefined && l.availableAt <= simTime), [mc, simTime]);
  const pendLabs  = useMemo(() => (mc?.labs || []).filter(l => l.availableAt !== undefined && l.availableAt > simTime), [mc, simTime]);
  const availImgs = useMemo(() => (mc?.imaging || []).filter(i => i.availableAt !== undefined && i.availableAt <= simTime), [mc, simTime]);
  const pendImgs  = useMemo(() => (mc?.imaging || []).filter(i => i.availableAt !== undefined && i.availableAt > simTime), [mc, simTime]);
  const activeMeds = useMemo(() => (mc?.medications || []).filter(m => m.discontinuedAt === undefined), [mc]);

  const isBusy = intervening || calling;

  // Vitals data
  const sbp = mc ? parseInt(mc.vitals.bloodPressure.split('/')[0]) || 120 : 120;
  const dbp = mc ? parseInt(mc.vitals.bloodPressure.split('/')[1]) || 80 : 80;
  const vData = mc ? [
    { key: 'hr',   label: 'HR',   value: mc.vitals.heartRate,         unit: 'bpm', status: vitalStatus('hr', mc.vitals.heartRate) },
    { key: 'bp',   label: 'BP',   value: sbp,                          unit: 'mmHg', display: mc.vitals.bloodPressure, status: vitalStatus('sbp', sbp) },
    { key: 'spo2', label: 'SpO₂', value: mc.vitals.oxygenSaturation,  unit: '%',   status: vitalStatus('spo2', mc.vitals.oxygenSaturation) },
    { key: 'rr',   label: 'RR',   value: mc.vitals.respiratoryRate,   unit: '/min', status: vitalStatus('rr', mc.vitals.respiratoryRate) },
    { key: 'temp', label: 'Temp', value: mc.vitals.temperature,       unit: '°C',  status: vitalStatus('temp', mc.vitals.temperature) },
  ] : [];

  // Sparkline series from vitals history or mock
  const sparkSeries = useMemo(() => {
    if (!mc) return {};
    const hist = vitalsHistory || [];
    if (hist.length >= 2) {
      return {
        hr:   hist.map(h => h.hr),
        spo2: hist.map(h => h.spo2),
        rr:   hist.map(h => h.rr),
        temp: hist.map(h => h.rr), // temp not in VitalsHistoryEntry, use rr as fallback
        bp:   hist.map(h => h.sbp),
      };
    }
    // generate mock sparkline around current value
    const mock = (v: number, spread = 8) => Array.from({ length: 10 }, (_, i) => v + (Math.sin(i) * spread * 0.5) + (Math.random() - 0.5) * spread * 0.3);
    return {
      hr:   mock(mc.vitals.heartRate, 15),
      spo2: mock(mc.vitals.oxygenSaturation, 3),
      rr:   mock(mc.vitals.respiratoryRate, 4),
      temp: mock(mc.vitals.temperature, 0.5),
      bp:   mock(sbp, 12),
    };
  }, [mc, vitalsHistory]);

  // Active clinical events / alarms
  const clinEvents = useMemo(() => {
    if (!mc) return [];
    const ev: { label: string; desc: string; level: 'critical' | 'warning' }[] = [];
    if (mc.vitals.oxygenSaturation < 88) ev.push({ label: 'SpO₂', desc: `${mc.vitals.oxygenSaturation}% — Critical hypoxia`, level: 'critical' });
    else if (mc.vitals.oxygenSaturation < 94) ev.push({ label: 'SpO₂', desc: `${mc.vitals.oxygenSaturation}% — Below target`, level: 'warning' });
    if (sbp < 80) ev.push({ label: 'BP', desc: `${mc.vitals.bloodPressure} — Severe hypotension`, level: 'critical' });
    else if (sbp < 90) ev.push({ label: 'BP', desc: `${mc.vitals.bloodPressure} — Hypotension`, level: 'warning' });
    if (mc.vitals.heartRate > 150) ev.push({ label: 'HR', desc: `${mc.vitals.heartRate} bpm — Tachycardia`, level: 'critical' });
    if (mc.vitals.temperature > 38.3) ev.push({ label: 'Temp', desc: `${mc.vitals.temperature}°C — Fever`, level: 'warning' });
    const critLabs = availLabs.filter(l => l.status === 'critical');
    critLabs.forEach(l => ev.push({ label: l.name, desc: `${l.value} ${l.unit} — Critical result`, level: 'critical' }));
    mc.activeAlarms?.forEach(a => ev.push({ label: '⚡', desc: a, level: 'warning' }));
    return ev;
  }, [mc, sbp, availLabs]);

  // Active orders for panel
  const activeOrders = useMemo(() => {
    if (!mc) return [];
    return [...(mc.clinicalActions || [])].reverse().slice(0, 12);
  }, [mc]);

  // ── Auth gate ──────────────────────────────────────────────────────────────
  if (isSupabaseConfigured && !isAuthLoading && !user) return (
    <div style={{ minHeight: '100vh', background: E.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: E.font }}>
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} isRecovery={isRecovery} onRecoveryHandled={clearRecovery} />
      <div style={{ background: E.panel, padding: 40, width: 340, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
        <div style={{ background: E.teal, color: '#fff', padding: '10px 14px', marginBottom: 24, fontSize: 16, fontWeight: 700, letterSpacing: -0.5 }}>
          <span style={{ fontStyle: 'italic', fontWeight: 900, fontSize: 22 }}>epic</span>
          <span style={{ marginLeft: 12, fontSize: 13, fontWeight: 400, opacity: 0.8 }}>Clinical Workstation</span>
        </div>
        <p style={{ fontSize: 13, color: E.textSm, marginBottom: 20 }}>Sign in to access patient records.</p>
        <button onClick={() => setIsAuthOpen(true)} style={{ padding: '7px 20px', background: E.teal, color: '#fff', border: 'none', fontSize: 13, cursor: 'pointer', fontFamily: E.font }}>Sign In</button>
      </div>
    </div>
  );

  if (isAuthLoading || loading || error) return (
    <div style={{ minHeight: '100vh', background: E.bodyBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: E.font, fontSize: 13 }}>
      {error ? (
        <div style={{ background: E.panel, border: `1px solid ${E.border}`, padding: 28, maxWidth: 360, textAlign: 'center' }}>
          <p style={{ color: E.red, fontWeight: 600, marginBottom: 8 }}>Connection Error</p>
          <p style={{ color: E.textSm, marginBottom: 16 }}>{error}</p>
          <button onClick={() => loadNewCase()} style={{ padding: '5px 16px', background: E.teal, color: '#fff', border: 'none', cursor: 'pointer' }}>Retry</button>
        </div>
      ) : (
        <div style={{ textAlign: 'center', color: E.muted }}>{loadingStep || 'Loading…'}</div>
      )}
    </div>
  );

  const today = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  const dob = mc ? `${String(mc.age).padStart(2, '0')}-year-old` : '';

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: E.font, fontSize: 12, background: E.bodyBg, color: E.text }}>

      {/* Global overlays */}
      <CaseLibrary isOpen={isLibraryOpen} onClose={() => setIsLibraryOpen(false)} onSelectCase={(d, c, e) => { setIsLibraryOpen(false); loadNewCase(d, c, e); }} />
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} isRecovery={isRecovery} onRecoveryHandled={clearRecovery} />
      <CommandPalette isOpen={isCommandOpen} onClose={() => setIsCommandOpen(false)} onNavigate={() => {}} onNewCase={() => setIsLibraryOpen(true)} onConsult={handleConsult} hasArchive={!!user} onOrderTest={mc ? handleOrderTest : undefined} onAdminister={mc ? med => handlePerformIntervention(2, `Administer ${med}`) : undefined} onAdvanceTime={mc ? handleAdvanceTime : undefined} />
      {timeAdvOpen && mc && <TimeAdvanceModal medicalCase={mc} simTime={simTime} intervening={intervening} onAdvance={handleAdvanceTime} onClose={() => setTimeAdvOpen(false)} />}

      {/* ── TOP NAVIGATION BAR ── */}
      <header style={{ background: E.teal, color: '#fff', height: 32, display: 'flex', alignItems: 'center', padding: '0 10px', flexShrink: 0, gap: 0 }}>
        {/* Epic logo */}
        <span style={{ fontStyle: 'italic', fontWeight: 900, fontSize: 18, letterSpacing: -0.5, marginRight: 16 }}>epic</span>
        {/* Nav items */}
        {['Appboard', 'Patient Lists', 'Routed', 'My Basket', 'Scan Team', 'Chart Room', 'Analytics', 'References', 'Manage'].map(item => (
          <button key={item} onClick={item === 'Patient Lists' ? () => setIsLibraryOpen(true) : undefined}
            style={{ padding: '0 9px', height: 32, background: 'none', border: 'none', color: 'rgba(255,255,255,0.88)', fontSize: 11, cursor: 'pointer', borderRight: `1px solid rgba(255,255,255,0.15)`, whiteSpace: 'nowrap' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
            {item}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {/* Right controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11 }}>
          <button onClick={() => setIsCommandOpen(true)} style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '2px 8px', cursor: 'pointer', fontSize: 10, fontFamily: E.font }}>⌘K</button>
          {user && <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>{user.email?.split('@')[0]}</span>}
          <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 10, textDecoration: 'underline' }}>Sign Out</button>
          <span style={{ fontFamily: E.mono, fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>{today}</span>
        </div>
      </header>

      {/* ── BODY ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── LEFT SIDEBAR — Patient List ── */}
        <aside style={{ width: 178, flexShrink: 0, background: E.panel, borderRight: `1px solid ${E.borderDk}`, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          {/* Sidebar header */}
          <div style={{ background: E.teal, color: '#fff', padding: '4px 8px', fontSize: 11, fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <span>Patient List</span>
            <button onClick={() => setIsLibraryOpen(true)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', fontSize: 9, padding: '1px 5px', cursor: 'pointer' }}>+ New</button>
          </div>

          {/* Group: 3A */}
          <SidebarGroup label="3A Patients" color="#2196f3" />
          {MOCK_PATIENTS.filter(p => p.room.startsWith('3A')).map(p => (
            <SidebarPatient key={p.name} patient={p} selected={selectedPt === p.name || (mc?.patientName.includes(p.name.split(',')[0]))} onClick={() => setSelectedPt(p.name)} />
          ))}

          {/* Current patient (if loaded and not in mock list) */}
          {mc && (
            <>
              <SidebarGroup label="Current Case" color={E.teal} />
              <SidebarPatient
                patient={{ name: `${mc.patientName.split(' ').slice(-1)[0]}, ${mc.patientName.split(' ')[0]}`, age: `${mc.age}${mc.gender?.[0]}`, status: mc.physiologicalTrend === 'critical' ? 'critical' : mc.physiologicalTrend === 'declining' ? 'abnormal' : 'stable', room: mc.currentLocation?.slice(0, 6) || 'ED-1' }}
                selected
                onClick={() => {}}
              />
            </>
          )}

          {/* Group: ICU */}
          <SidebarGroup label="ICU Patients" color="#f44336" />
          {MOCK_PATIENTS.filter(p => p.room.startsWith('ICU')).map(p => (
            <SidebarPatient key={p.name} patient={p} selected={false} onClick={() => setSelectedPt(p.name)} />
          ))}

          {/* Group: 3C */}
          <SidebarGroup label="3C Patients" color="#4caf50" />
          {MOCK_PATIENTS.filter(p => p.room.startsWith('3C')).map(p => (
            <SidebarPatient key={p.name} patient={p} selected={false} onClick={() => setSelectedPt(p.name)} />
          ))}

          <div style={{ flex: 1 }} />

          {/* Quick links */}
          <div style={{ borderTop: `1px solid ${E.border}`, padding: '4px 0' }}>
            {['Follow Up', 'Referrals', 'Quick Links'].map(label => (
              <div key={label} style={{ padding: '4px 10px', fontSize: 11, color: E.teal, cursor: 'pointer', borderBottom: `1px solid ${E.border}` }}
                onMouseEnter={e => (e.currentTarget.style.background = E.tealLight)}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                {label}
              </div>
            ))}
          </div>
        </aside>

        {/* ── CHART AREA ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {!mc ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: E.bodyBg }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: E.muted, marginBottom: 16 }}>No patient selected</p>
                <button onClick={() => loadNewCase()} style={{ padding: '6px 18px', background: E.teal, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontFamily: E.font }}>Generate Case</button>
                {' '}
                <button onClick={() => setIsLibraryOpen(true)} style={{ padding: '6px 18px', background: 'none', color: E.teal, border: `1px solid ${E.teal}`, cursor: 'pointer', fontSize: 12, fontFamily: E.font, marginLeft: 8 }}>Browse Library</button>
              </div>
            </div>
          ) : (
            <>
              {/* ── PATIENT HEADER BAND ── */}
              <div style={{ background: E.teal, color: '#fff', padding: '5px 10px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    {/* Patient name */}
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 2 }}>
                      <span style={{ fontWeight: 700, fontSize: 17, letterSpacing: -0.3 }}>
                        {mc.patientName.includes(',') ? mc.patientName : `${mc.patientName.split(' ').slice(-1)[0]}, ${mc.patientName.split(' ').slice(0, -1).join(' ')}`}
                      </span>
                      {mc.difficulty && <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.2)', padding: '1px 6px', borderRadius: 2 }}>{mc.difficulty.toUpperCase()}</span>}
                    </div>
                    {/* Demographics row 1 */}
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.82)', display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 1 }}>
                      <span>Age: <strong style={{ color: '#fff' }}>{mc.age} y/o {mc.gender}</strong></span>
                      <span>MRN: <strong style={{ color: '#fff' }}>{mc.id.slice(-8).toUpperCase()}</strong></span>
                      <span>Code: <strong style={{ color: '#fff' }}>Full Code</strong></span>
                      {mc.specialty_tags?.length ? <span>Specialty: <strong style={{ color: '#c8e8ff' }}>{mc.specialty_tags.join(', ')}</strong></span> : null}
                    </div>
                    {/* Demographics row 2 */}
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.82)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <span>Location: <strong style={{ color: '#fff' }}>{mc.currentLocation}</strong></span>
                      {mc.physiologicalTrend && mc.physiologicalTrend !== 'stable' && (
                        <span style={{ background: mc.physiologicalTrend === 'improving' ? '#1a6e2e' : '#8b1a1a', padding: '0 6px', borderRadius: 2, color: '#fff', fontWeight: 600 }}>
                          {mc.physiologicalTrend === 'improving' ? '↑' : mc.physiologicalTrend === 'critical' ? '⚠' : '↓'} {mc.physiologicalTrend.toUpperCase()}
                        </span>
                      )}
                      {patientOutcome && patientOutcome !== 'alive' && (
                        <span style={{ background: patientOutcome === 'deceased' ? '#111' : '#8b0000', padding: '0 8px', borderRadius: 2, color: '#fff', fontWeight: 700 }}>
                          {patientOutcome === 'deceased' ? '✕ EXPIRED' : '⚠ DETERIORATING'}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Allergy badge + controls */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ background: '#c0392b', padding: '3px 8px', maxWidth: 240, fontSize: 10, lineHeight: 1.4 }}>
                      <span style={{ fontWeight: 700, color: '#fff' }}>⚠ ALLERGIES: </span>
                      <span style={{ color: '#ffd6d6' }}>NKDA</span>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => loadNewCase()} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', padding: '3px 8px', cursor: 'pointer', fontSize: 10, fontFamily: E.font }}>New Case</button>
                      <button onClick={() => setAssessOpen(true)} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', padding: '3px 8px', cursor: 'pointer', fontSize: 10, fontFamily: E.font }}>End Case</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── SECONDARY CHART NAV TABS ── */}
              <div style={{ background: E.tabBar, display: 'flex', borderBottom: `2px solid ${E.borderDk}`, flexShrink: 0 }}>
                {['Chart Review', 'Flowsheet', 'Medications', 'Plan', 'Care Plan', 'Notes', 'Orders', 'Results'].map(tab => (
                  <button key={tab} onClick={() => setActiveChartTab(tab.toLowerCase().replace(' ', '-'))}
                    style={{
                      padding: '5px 12px', fontSize: 11, fontFamily: E.font, cursor: 'pointer',
                      background: activeChartTab === tab.toLowerCase().replace(' ', '-') ? E.panel : 'transparent',
                      border: 'none', borderRight: `1px solid ${E.border}`,
                      borderBottom: activeChartTab === tab.toLowerCase().replace(' ', '-') ? `2px solid ${E.panel}` : 'none',
                      color: activeChartTab === tab.toLowerCase().replace(' ', '-') ? E.teal : E.textSm,
                      fontWeight: activeChartTab === tab.toLowerCase().replace(' ', '-') ? 600 : 400,
                      marginBottom: activeChartTab === tab.toLowerCase().replace(' ', '-') ? -2 : 0,
                    }}>
                    {tab}
                  </button>
                ))}
                <div style={{ flex: 1 }} />
                <button onClick={() => setIsDxPadOpen(p => !p)} style={{ padding: '4px 10px', fontSize: 10, background: 'none', border: 'none', color: E.teal, cursor: 'pointer', fontFamily: E.font }}>Dx Pad</button>
              </div>

              {/* ── VITALS STRIP ── */}
              <div style={{ background: E.panel, borderBottom: `1px solid ${E.border}`, padding: '6px 10px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: E.muted, marginRight: 10, letterSpacing: 0.5, whiteSpace: 'nowrap' }}>
                    VITALS {simTime > 0 ? `Last ${simTime}m` : ''}
                  </span>
                  {vData.map(vd => {
                    const spark = sparkSeries[vd.key as keyof typeof sparkSeries] || [];
                    const col = statusColor(vd.status);
                    return (
                      <div key={vd.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2px 10px', borderRight: `1px solid ${E.border}`, minWidth: 90 }}>
                        <div style={{ fontSize: 9, fontWeight: 600, color: E.muted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 1 }}>{vd.label}</div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                          <span style={{ fontSize: 20, fontWeight: 700, fontFamily: E.mono, color: col, lineHeight: 1 }}>
                            {vd.display ?? vd.value}
                          </span>
                          {vd.status !== 'normal' && <span style={{ fontSize: 11, color: col }}>{vd.status === 'critical' ? '⚠' : '!'}</span>}
                        </div>
                        <span style={{ fontSize: 9, color: E.muted }}>{vd.unit}</span>
                        <Sparkline values={spark.length >= 2 ? spark : [vd.value, vd.value]} color={col} width={72} height={24} />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── MAIN 4-COLUMN CONTENT GRID ── */}
              <div style={{ flex: 1, display: 'flex', overflow: 'hidden', gap: 0 }}>

                {/* COL 1: Timeline */}
                <div style={{ width: 220, flexShrink: 0, borderRight: `1px solid ${E.border}`, display: 'flex', flexDirection: 'column', background: E.panel, overflow: 'hidden' }}>
                  <SectionHead title="Timeline" />
                  {/* Tab bar */}
                  <div style={{ display: 'flex', borderBottom: `1px solid ${E.border}`, background: E.panelHead }}>
                    {(['all', 'events', 'orders', 'results'] as const).map(t => (
                      <button key={t} onClick={() => setActiveTimelineTab(t)}
                        style={{ flex: 1, padding: '3px 0', fontSize: 10, background: activeTimelineTab === t ? E.panel : 'none', border: 'none', borderBottom: activeTimelineTab === t ? `2px solid ${E.teal}` : 'none', cursor: 'pointer', color: activeTimelineTab === t ? E.teal : E.muted, fontFamily: E.font, fontWeight: activeTimelineTab === t ? 600 : 400 }}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>
                  {/* Timeline entries */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
                    {(mc.clinicalActions || []).length === 0 ? (
                      <p style={{ padding: '10px 10px', fontSize: 11, color: E.muted }}>No entries yet.</p>
                    ) : (
                      [...(mc.clinicalActions || [])].reverse()
                        .filter(a => {
                          if (activeTimelineTab === 'all') return true;
                          if (activeTimelineTab === 'orders') return ['order', 'exam', 'procedure'].includes(a.type);
                          if (activeTimelineTab === 'events') return ['medication', 'communication'].includes(a.type);
                          return false;
                        })
                        .map((a, i) => {
                          const badge = ACTION_BADGE[a.type] || ACTION_BADGE['order'];
                          return (
                            <div key={a.id} style={{ display: 'flex', gap: 6, padding: '4px 8px', borderBottom: `1px solid #f0f3f5`, background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 2 }}>
                                <span style={{ fontSize: 9, fontFamily: E.mono, color: E.muted, whiteSpace: 'nowrap' }}>T+{a.timestamp}m</span>
                                <div style={{ width: 1, flex: 1, background: E.border, marginTop: 3 }} />
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 2, background: badge.bg, color: badge.color }}>{badge.label}</span>
                                <p style={{ fontSize: 11, color: E.text, marginTop: 2, lineHeight: 1.4 }}>{a.description}</p>
                                {a.impact && <p style={{ fontSize: 10, color: E.muted, fontStyle: 'italic', marginTop: 1 }}>{a.impact}</p>}
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>

                {/* COL 2: Patient Summary */}
                <div style={{ width: 260, flexShrink: 0, borderRight: `1px solid ${E.border}`, display: 'flex', flexDirection: 'column', background: E.panel, overflow: 'hidden' }}>
                  <SectionHead title="Patient Summary" />
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    {/* HPI */}
                    <SubHead label="HISTORY OF PRESENT ILLNESS" />
                    <div style={{ padding: '6px 10px', fontSize: 12, lineHeight: 1.65, color: E.text, borderBottom: `1px solid ${E.border}` }}>
                      {mc.historyOfPresentIllness}
                    </div>
                    {/* Chief Complaint */}
                    <SubHead label="CHIEF COMPLAINT" />
                    <div style={{ padding: '5px 10px', fontSize: 12, color: E.text, borderBottom: `1px solid ${E.border}` }}>
                      {mc.chiefComplaint}
                    </div>
                    {mc.initialAppearance && (
                      <>
                        <SubHead label="INITIAL APPEARANCE" />
                        <div style={{ padding: '5px 10px', fontSize: 12, color: E.text, fontStyle: 'italic', borderBottom: `1px solid ${E.border}` }}>
                          {mc.initialAppearance}
                        </div>
                      </>
                    )}
                    {/* PMH */}
                    <SubHead label="PAST MEDICAL HISTORY" />
                    <div style={{ borderBottom: `1px solid ${E.border}` }}>
                      {(mc.pastMedicalHistory || []).map((h, i) => (
                        <div key={i} style={{ padding: '3px 10px', fontSize: 11, color: E.text, background: i % 2 ? E.bodyBg : '#fff', borderBottom: `1px solid #f0f3f5` }}>
                          • {h}
                        </div>
                      ))}
                    </div>
                    {/* Current Medications */}
                    {activeMeds.length > 0 && (
                      <>
                        <SubHead label={`CURRENT MEDICATIONS (${activeMeds.length})`} />
                        <div style={{ borderBottom: `1px solid ${E.border}` }}>
                          {activeMeds.map((m, i) => (
                            <div key={m.id} style={{ padding: '3px 10px', fontSize: 11, color: E.text, background: i % 2 ? E.bodyBg : '#fff', borderBottom: `1px solid #f0f3f5`, display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontWeight: 500 }}>{m.name}</span>
                              <span style={{ color: E.muted, fontSize: 10 }}>{m.dose} {m.route}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                    {/* Management conflicts */}
                    {mc.managementConflicts?.length ? (
                      <>
                        <SubHead label="⚠ MANAGEMENT CONFLICTS" color="#7d5c00" bg="#fff3cd" />
                        {mc.managementConflicts.map((c, i) => (
                          <div key={i} style={{ padding: '4px 10px', fontSize: 11, color: E.amber, background: E.amberLt, borderBottom: `1px solid #fde68a` }}>
                            {c}
                          </div>
                        ))}
                      </>
                    ) : null}
                    {/* Consultant advice */}
                    {consultantAdvice && (
                      <>
                        <SubHead label="CONSULTANT ADVICE" color={E.teal} />
                        <div style={{ padding: '6px 10px', fontSize: 11, background: E.tealLight, borderBottom: `1px solid ${E.border}` }}>
                          <p style={{ fontStyle: 'italic', marginBottom: 6, lineHeight: 1.5 }}>{consultantAdvice.advice}</p>
                          <p style={{ fontSize: 10, color: E.textSm, lineHeight: 1.5, marginBottom: 6 }}>{consultantAdvice.reasoning}</p>
                          {consultantAdvice.recommendedActions.map((a, i) => (
                            <div key={i} style={{ fontSize: 11, color: E.text, marginBottom: 3 }}>
                              <span style={{ fontWeight: 700, color: E.teal }}>{i + 1}. </span>{a}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                    {isConsulting && (
                      <div style={{ padding: '10px', textAlign: 'center', color: E.muted, fontSize: 11 }}>Consulting…</div>
                    )}
                  </div>
                </div>

                {/* COL 3: Labs + Imaging */}
                <div style={{ flex: 1, borderRight: `1px solid ${E.border}`, display: 'flex', flexDirection: 'column', background: E.panel, overflow: 'hidden', minWidth: 0 }}>

                  {/* Labs section */}
                  <div style={{ flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: E.panelHead, borderBottom: `1px solid ${E.border}`, padding: '3px 10px' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: E.textSm, textTransform: 'uppercase', letterSpacing: 0.5 }}>Latest Labs</span>
                      <span style={{ fontSize: 10, color: E.muted }}>Last 24 hrs</span>
                    </div>
                    {availLabs.length === 0 && pendLabs.length === 0 ? (
                      <p style={{ padding: '8px 10px', fontSize: 11, color: E.muted }}>No labs ordered.</p>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                        <thead>
                          <tr style={{ background: '#f0f4f6' }}>
                            <th style={th}>Test</th>
                            <th style={{ ...th, textAlign: 'right' }}>Result</th>
                            <th style={{ ...th, textAlign: 'center', width: 34 }}>Flag</th>
                            <th style={th}>Reference</th>
                            <th style={{ ...th, textAlign: 'right' }}>T+</th>
                          </tr>
                        </thead>
                        <tbody>
                          {availLabs.map((l, i) => {
                            const f = labFlagInfo(l);
                            return (
                              <tr key={i} style={{ background: l.status === 'critical' ? E.redLt : l.status === 'abnormal' ? E.amberLt : i % 2 ? E.bodyBg : '#fff', borderBottom: `1px solid #eef1f4` }}>
                                <td style={{ padding: '3px 8px', color: E.text }}>{l.name}</td>
                                <td style={{ padding: '3px 8px', textAlign: 'right', fontFamily: E.mono, fontWeight: l.status !== 'normal' ? 700 : 400, color: l.status === 'critical' ? E.red : l.status === 'abnormal' ? E.amber : E.text }}>{l.value}</td>
                                <td style={{ padding: '3px 4px', textAlign: 'center' }}>
                                  {f.code ? <span style={{ fontSize: 9, fontWeight: 700, color: f.color }}>{f.code}</span> : <span style={{ color: E.green, fontSize: 10 }}>✓</span>}
                                </td>
                                <td style={{ padding: '3px 8px', fontFamily: E.mono, color: E.muted, fontSize: 10 }}>{l.normalRange}</td>
                                <td style={{ padding: '3px 8px', textAlign: 'right', fontFamily: E.mono, fontSize: 9, color: E.muted }}>{l.availableAt}m</td>
                              </tr>
                            );
                          })}
                          {pendLabs.map((l, i) => (
                            <tr key={`p${i}`} style={{ background: E.bodyBg, borderBottom: `1px solid #eef1f4` }}>
                              <td style={{ padding: '3px 8px', color: E.muted }}>{l.name}</td>
                              <td colSpan={3} style={{ padding: '3px 8px', color: E.muted, fontStyle: 'italic', fontSize: 10 }}>Pending · ETA T+{l.availableAt}m ({Math.max(0, (l.availableAt ?? 0) - simTime)} min)</td>
                              <td style={{ padding: '3px 8px', textAlign: 'right', fontFamily: E.mono, fontSize: 9, color: E.muted }}>{l.availableAt}m</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* Physical exam (collapsed accordion) */}
                  <div style={{ borderTop: `1px solid ${E.border}`, flex: 1, overflowY: 'auto' }}>
                    <SubHead label="PHYSICAL EXAMINATION" />
                    {mc.physicalExam && (Object.entries(mc.physicalExam) as [string, string][]).map(([sys, val], i) => {
                      const locked = val === '[[LOCKED]]';
                      return (
                        <div key={sys} style={{ display: 'flex', borderBottom: `1px solid #eef1f4`, background: i % 2 ? E.bodyBg : '#fff' }}>
                          <span style={{ width: 90, flexShrink: 0, padding: '4px 8px', fontSize: 10, fontWeight: 600, color: E.muted, textTransform: 'uppercase', borderRight: `1px solid #eef1f4` }}>{sys}</span>
                          <div style={{ flex: 1, padding: '4px 8px', fontSize: 11, color: locked ? E.muted : E.text, lineHeight: 1.4 }}>
                            {locked ? (
                              <button onClick={() => {
                                setMedicalCase(prev => prev ? { ...prev, clinicalActions: [...(prev.clinicalActions || []), { id: `exam-${Date.now()}`, timestamp: prev.simulationTime, type: 'exam' as const, description: `Performed physical exam: ${sys}` }] } : prev);
                              }} style={{ fontSize: 10, color: E.teal, background: 'none', border: `1px solid ${E.teal}`, padding: '1px 6px', cursor: 'pointer', fontFamily: E.font }}>Perform</button>
                            ) : val}
                          </div>
                        </div>
                      );
                    })}

                    {/* Recent Imaging */}
                    {(availImgs.length > 0 || pendImgs.length > 0) && (
                      <>
                        <SubHead label="RECENT IMAGING" />
                        {availImgs.map((img, i) => (
                          <div key={i} style={{ borderBottom: `1px solid #eef1f4` }}>
                            <button onClick={() => setImgOpen(p => ({ ...p, [img.type]: !p[img.type] }))}
                              style={{ width: '100%', padding: '5px 10px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', fontFamily: E.font }}>
                              <span style={{ fontSize: 11, fontWeight: 600, color: E.blue }}>{img.type}</span>
                              <span style={{ fontSize: 10, color: E.muted }}>{imgOpen[img.type] ? '▲' : '▼'} T+{img.availableAt}m</span>
                            </button>
                            {imgOpen[img.type] && (
                              <div style={{ padding: '4px 12px 8px', background: E.bodyBg, fontSize: 11, lineHeight: 1.6 }}>
                                {img.findings && <p style={{ marginBottom: 4, color: E.textSm }}><strong>Findings: </strong>{img.findings}</p>}
                                {img.impression && <p style={{ color: E.red, fontWeight: 600 }}><strong>Impression: </strong>{img.impression}</p>}
                              </div>
                            )}
                          </div>
                        ))}
                        {pendImgs.map((img, i) => (
                          <div key={i} style={{ padding: '5px 10px', borderBottom: `1px solid #eef1f4`, color: E.muted, fontSize: 11, fontStyle: 'italic' }}>
                            {img.type} — Pending ETA T+{img.availableAt}m
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>

                {/* COL 4: Events + Orders + Tasks */}
                <div style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', background: E.panel, overflow: 'hidden' }}>

                  {/* Active Clinical Events */}
                  {clinEvents.length > 0 && (
                    <div style={{ flexShrink: 0, borderBottom: `1px solid ${E.border}` }}>
                      <div style={{ background: clinEvents.some(e => e.level === 'critical') ? E.red : E.amber, padding: '3px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>Active Clinical Events</span>
                        <span style={{ background: 'rgba(255,255,255,0.3)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '0 5px', borderRadius: 10 }}>{clinEvents.length}</span>
                      </div>
                      {clinEvents.slice(0, 4).map((ev, i) => (
                        <div key={i} style={{ padding: '4px 10px', borderBottom: `1px solid #eef1f4`, background: ev.level === 'critical' ? E.redLt : E.amberLt, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: ev.level === 'critical' ? E.red : E.amber, minWidth: 36 }}>{ev.label}</span>
                          <span style={{ fontSize: 10, color: E.textSm, lineHeight: 1.4 }}>{ev.desc}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Orders */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderBottom: `1px solid ${E.border}` }}>
                    <div style={{ background: E.panelHead, borderBottom: `1px solid ${E.border}`, padding: '2px 0', display: 'flex', flexShrink: 0 }}>
                      {(['active', 'recent'] as const).map(t => (
                        <button key={t} onClick={() => setActiveOrderTab(t)}
                          style={{ flex: 1, padding: '3px 6px', fontSize: 10, fontFamily: E.font, background: activeOrderTab === t ? E.panel : 'none', border: 'none', borderBottom: activeOrderTab === t ? `2px solid ${E.teal}` : 'none', cursor: 'pointer', color: activeOrderTab === t ? E.teal : E.muted, fontWeight: activeOrderTab === t ? 600 : 400 }}>
                          {t.charAt(0).toUpperCase() + t.slice(1)} {t === 'active' ? `(${activeOrders.length})` : ''}
                        </button>
                      ))}
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
                      {activeOrders.length === 0 ? (
                        <p style={{ padding: '8px 10px', fontSize: 11, color: E.muted }}>No orders placed.</p>
                      ) : (
                        activeOrders.map((a, i) => {
                          const badge = ACTION_BADGE[a.type] || ACTION_BADGE['order'];
                          return (
                            <div key={a.id} style={{ padding: '3px 8px', borderBottom: `1px solid #f0f3f5`, display: 'flex', gap: 6, alignItems: 'flex-start', background: i % 2 ? '#fafbfc' : '#fff' }}>
                              <span style={{ fontSize: 9, fontFamily: E.mono, color: E.muted, minWidth: 34, paddingTop: 1 }}>T+{a.timestamp}m</span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <span style={{ fontSize: 9, padding: '1px 4px', borderRadius: 2, background: badge.bg, color: badge.color, fontWeight: 600 }}>{badge.label}</span>
                                <p style={{ fontSize: 11, color: E.text, marginTop: 1, lineHeight: 1.3 }}>{a.description}</p>
                                {a.impact && <p style={{ fontSize: 9, color: E.muted, fontStyle: 'italic' }}>{a.impact}</p>}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Tasks / To Do */}
                  <div style={{ flexShrink: 0 }}>
                    <SubHead label="TASKS / TO DO" />
                    <div style={{ padding: '4px 10px 6px' }}>
                      {mc.requiredConsultations?.length ? (
                        mc.requiredConsultations.map((c, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', borderBottom: `1px solid #eef1f4`, fontSize: 11 }}>
                            <span style={{ color: E.amber }}>●</span>
                            <span style={{ flex: 1, color: E.text }}>Consult: {c}</span>
                            <button onClick={() => handleConsult()} disabled={isBusy} style={{ fontSize: 9, color: E.teal, background: 'none', border: `1px solid ${E.teal}`, padding: '1px 5px', cursor: 'pointer', fontFamily: E.font }}>Do</button>
                          </div>
                        ))
                      ) : (
                        <p style={{ fontSize: 11, color: E.muted }}>No pending tasks.</p>
                      )}
                      <button onClick={() => setAssessOpen(true)} style={{ marginTop: 6, width: '100%', padding: '4px 0', fontSize: 11, background: E.teal, color: '#fff', border: 'none', cursor: 'pointer', fontFamily: E.font }}>
                        End Case / Assessment
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── CPOE BAR ── */}
              <CPOEBar
                caseId={mc.id} simTime={simTime} busy={isBusy}
                onExecute={t => handlePerformIntervention(5, t)}
                onOpenTimeAdvance={() => setTimeAdvOpen(true)}
                onOrderTest={handleOrderTest}
                onOrderMedication={handleOrderMedication}
                onConsult={handleConsult}
              />
            </>
          )}
        </div>
      </div>

      {/* ── Assessment overlay ── */}
      <AnimatePresence>
        {assessOpen && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 50, overflowY: 'auto', fontFamily: E.font }}>
            <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 20px 80px' }}>
              <div style={{ background: E.teal, color: '#fff', padding: '8px 14px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Case Assessment &amp; Scoring</span>
                <button onClick={() => setAssessOpen(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: '2px 8px', cursor: 'pointer', fontFamily: E.font }}>← Back to Chart</button>
              </div>
              <AssessmentTab medicalCase={mc} simTime={simTime} userNotes={userNotes} evaluation={evaluation} submitting={submitting} logs={logs} differential={differential} onDifferentialChange={setDifferential} onNotesChange={setUserNotes} onEndCase={handleEndCase} onNewCase={() => { setAssessOpen(false); loadNewCase(); }} />
              {user && <div style={{ marginTop: 40, paddingTop: 24, borderTop: `1px solid ${E.border}` }}><ArchiveView user={user} /></div>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DiagnosisPad */}
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

// ─── Sidebar helpers ───────────────────────────────────────────────────────────
function SidebarGroup({ label, color }: { label: string; color: string }) {
  return (
    <div style={{ padding: '3px 8px', fontSize: 10, fontWeight: 700, color: '#fff', background: color, display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
      {label}
    </div>
  );
}

function SidebarPatient({ patient, selected, onClick }: {
  patient: { name: string; age: string; status: string; room: string };
  selected: boolean;
  onClick: () => void;
}) {
  const dotColor = patient.status === 'critical' ? E.red : patient.status === 'abnormal' ? E.amber : E.green;
  return (
    <button onClick={onClick} style={{ width: '100%', padding: '4px 8px', background: selected ? E.tealLight : 'none', border: 'none', borderBottom: `1px solid ${E.border}`, cursor: 'pointer', textAlign: 'left', fontFamily: E.font, display: 'flex', alignItems: 'center', gap: 6 }}
      onMouseEnter={e => !selected && (e.currentTarget.style.background = '#f0f7fa')}
      onMouseLeave={e => !selected && (e.currentTarget.style.background = 'none')}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 11, fontWeight: selected ? 600 : 400, color: selected ? E.teal : E.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{patient.name}</p>
        <p style={{ fontSize: 10, color: E.muted }}>{patient.room} · {patient.age}</p>
      </div>
    </button>
  );
}

// ─── Panel primitives ──────────────────────────────────────────────────────────
function SectionHead({ title }: { title: string }) {
  return (
    <div style={{ background: E.teal, color: '#fff', padding: '4px 10px', fontSize: 11, fontWeight: 600, letterSpacing: 0.3, flexShrink: 0 }}>
      {title}
    </div>
  );
}

function SubHead({ label, color = E.textSm, bg = E.panelHead }: { label: string; color?: string; bg?: string }) {
  return (
    <div style={{ background: bg, padding: '3px 10px', fontSize: 10, fontWeight: 600, color, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: `1px solid ${E.border}`, borderTop: `1px solid ${E.border}` }}>
      {label}
    </div>
  );
}

const th: React.CSSProperties = {
  padding: '3px 8px',
  textAlign: 'left',
  fontSize: 10,
  fontWeight: 600,
  color: E.muted,
  textTransform: 'uppercase' as const,
  letterSpacing: 0.3,
  borderBottom: `1px solid ${E.border}`,
  borderRight: `1px solid #eef1f4`,
};
