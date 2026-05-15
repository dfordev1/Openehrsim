/**
 * ClinicalLayout — Epic EHR pixel-perfect clone.
 * Dark teal nav · patient list sidebar · vitals sparklines · 4-column grid.
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
import type { LabResult, OrderSearchResult } from '../types';
import type { VitalsHistoryEntry } from '../hooks/useVitalsPoll';

// ─── Epic colour palette ───────────────────────────────────────────────────────
const E = {
  teal:      '#1b5e6e',
  tealDk:    '#144d5c',
  tealLt:    '#e8f4f7',
  tabBar:    '#dce8ed',
  bodyBg:    '#f0f3f5',
  panel:     '#ffffff',
  panelHd:   '#e8ecef',
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
  componentDidCatch(e: Error, i: ErrorInfo) {
    Sentry.captureException(e, { extra: { componentStack: i.componentStack } });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, fontFamily: E.font, fontSize: 13 }}>
          <strong>Application Error</strong>
          <button onClick={() => window.location.reload()} style={{ marginLeft: 16, padding: '4px 12px' }}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export { ErrorBoundary };
export function ClinicalLayout() {
  return (
    <ErrorBoundary>
      <EpicShell />
    </ErrorBoundary>
  );
}

// ─── Vitals helpers ────────────────────────────────────────────────────────────
type VitalStatus = 'critical' | 'abnormal' | 'normal';

function vitalStatus(key: string, val: number): VitalStatus {
  if (key === 'hr')   return val > 150 || val < 40 ? 'critical' : val > 100 || val < 60 ? 'abnormal' : 'normal';
  if (key === 'sbp')  return val < 80 || val > 180 ? 'critical' : val < 90 || val > 160 ? 'abnormal' : 'normal';
  if (key === 'spo2') return val < 88 ? 'critical' : val < 94 ? 'abnormal' : 'normal';
  if (key === 'rr')   return val > 30 || val < 8 ? 'critical' : val > 20 || val < 12 ? 'abnormal' : 'normal';
  if (key === 'temp') return val > 40 || val < 34 ? 'critical' : val > 38.3 || val < 36 ? 'abnormal' : 'normal';
  return 'normal';
}

function statusColor(s: VitalStatus): string {
  return s === 'critical' ? E.red : s === 'abnormal' ? E.amber : E.text;
}

// ─── Lab flag ─────────────────────────────────────────────────────────────────
function labFlagInfo(lab: LabResult): { code: string; color: string; bg: string } {
  if (lab.status === 'critical') {
    const v = parseFloat(String(lab.value));
    const lo = parseFloat(lab.normalRange.split('-')[0]);
    const isLow = !isNaN(v) && !isNaN(lo) && v < lo;
    return isLow
      ? { code: 'LL', color: E.blue, bg: E.blueLt }
      : { code: 'HH', color: E.red,  bg: E.redLt  };
  }
  if (lab.status === 'abnormal') {
    const v = parseFloat(String(lab.value));
    const parts = lab.normalRange.split('-');
    const lo = parseFloat(parts[0]);
    const hi = parseFloat(parts[parts.length - 1]);
    if (!isNaN(v) && !isNaN(lo) && !isNaN(hi)) {
      return v < lo
        ? { code: 'L', color: E.blue,  bg: E.blueLt  }
        : { code: 'H', color: E.amber, bg: E.amberLt };
    }
    return { code: 'H', color: E.amber, bg: E.amberLt };
  }
  return { code: '', color: E.green, bg: 'transparent' };
}

// ─── Sparkline ────────────────────────────────────────────────────────────────
function Sparkline({ values, color, w = 80, h = 28 }: {
  values: number[]; color: string; w?: number; h?: number;
}) {
  if (values.length < 2) return <svg width={w} height={h} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * (w - 4) + 2;
      const y = h - 4 - ((v - min) / range) * (h - 8);
      return x.toFixed(1) + ',' + y.toFixed(1);
    })
    .join(' ');
  const last = values[values.length - 1];
  const cx = (w - 2).toFixed(1);
  const cy = (h - 4 - ((last - min) / range) * (h - 8)).toFixed(1);
  return (
    <svg width={w} height={h} style={{ overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
      <circle cx={cx} cy={cy} r={2.5} fill={color} />
    </svg>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHead({ title }: { title: string }) {
  return (
    <div style={{
      background: E.teal, color: '#fff', padding: '4px 10px',
      fontSize: 11, fontWeight: 600, letterSpacing: 0.3, flexShrink: 0,
    }}>
      {title}
    </div>
  );
}

function SubHead({ label, bg = E.panelHd, color = E.textSm }: {
  label: string; bg?: string; color?: string;
}) {
  return (
    <div style={{
      background: bg, padding: '3px 10px', fontSize: 10, fontWeight: 600,
      color, textTransform: 'uppercase' as const, letterSpacing: 0.5,
      borderBottom: '1px solid ' + E.border, borderTop: '1px solid ' + E.border,
    }}>
      {label}
    </div>
  );
}

// ─── Patient list sidebar ─────────────────────────────────────────────────────
interface MockPatient {
  name: string; age: string; status: 'critical' | 'abnormal' | 'stable'; room: string;
}

const MOCK_PATIENTS: MockPatient[] = [
  { name: 'Cruz, Patricia',    age: '62F', status: 'critical', room: '3A-01' },
  { name: 'Alvarez, Jonathan', age: '45M', status: 'stable',   room: '3A-02' },
  { name: 'Garcia, Michael',   age: '71M', status: 'abnormal', room: '3A-03' },
  { name: 'Thompson, Sarah',   age: '38F', status: 'stable',   room: '3A-04' },
  { name: 'Martinez, Elena',   age: '49F', status: 'stable',   room: 'ICU-1' },
  { name: 'Brown, James',      age: '67M', status: 'critical', room: 'ICU-2' },
  { name: 'Lee, Michelle',     age: '52F', status: 'stable',   room: '3C-01' },
  { name: 'Davis, Robert',     age: '44M', status: 'stable',   room: '3C-02' },
];

function SidebarGroup({ label, color }: { label: string; color: string }) {
  return (
    <div style={{
      padding: '3px 8px', fontSize: 10, fontWeight: 700,
      color: '#fff', background: color, marginTop: 2,
    }}>
      {label}
    </div>
  );
}

function SidebarPatient({ patient, selected, onClick }: {
  patient: MockPatient; selected: boolean; onClick: () => void;
}) {
  const dotColor = patient.status === 'critical' ? E.red
    : patient.status === 'abnormal' ? E.amber
    : E.green;
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', padding: '4px 8px',
        background: selected ? E.tealLt : 'none',
        border: 'none', borderBottom: '1px solid ' + E.border,
        cursor: 'pointer', textAlign: 'left', fontFamily: E.font,
        display: 'flex', alignItems: 'center', gap: 6,
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = '#f0f7fa'; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'none'; }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 11, fontWeight: selected ? 600 : 400,
          color: selected ? E.teal : E.text,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          margin: 0,
        }}>
          {patient.name}
        </p>
        <p style={{ fontSize: 10, color: E.muted, margin: 0 }}>
          {patient.room} · {patient.age}
        </p>
      </div>
    </button>
  );
}

// ─── CPOE bar ──────────────────────────────────────────────────────────────────
function CPOEBar({ caseId, simTime, busy, onExecute, onOpenTimeAdvance, onOrderTest, onConsult }: {
  caseId: string | undefined;
  simTime: number;
  busy: boolean;
  onExecute: (t: string) => Promise<void>;
  onOpenTimeAdvance: () => void;
  onOrderTest: (type: 'lab' | 'imaging', name: string) => Promise<void>;
  onConsult: () => void;
}) {
  const [val, setVal]     = useState('');
  const [res, setRes]     = useState<OrderSearchResult[]>([]);
  const [placing, setPlacing] = useState(false);
  const deb = useRef<ReturnType<typeof setTimeout>>(undefined);
  const isBusy = busy || placing;

  const doSearch = useCallback((q: string) => {
    clearTimeout(deb.current);
    if (!q.trim() || !caseId) { setRes([]); return; }
    deb.current = setTimeout(async () => {
      try {
        setRes((await searchOrders(caseId, q)).results.slice(0, 7));
      } catch {
        setRes([]);
      }
    }, 250);
  }, [caseId]);

  const clear = () => { setVal(''); setRes([]); };

  const execute = async () => {
    const t = val.trim();
    if (!t || isBusy) return;
    clear();
    await onExecute(t);
  };

  const place = async (r: OrderSearchResult) => {
    if (isBusy) return;
    clear();
    setPlacing(true);
    try {
      if (r.category === 'lab')     await onOrderTest('lab', r.name);
      else if (r.category === 'imaging') await onOrderTest('imaging', r.name);
      else await onExecute(r.name);
    } finally {
      setPlacing(false);
    }
  };

  const catStyle = (cat: string): React.CSSProperties => {
    const map: Record<string, { bg: string; color: string }> = {
      lab:       { bg: E.blueLt,   color: E.blue  },
      imaging:   { bg: '#f3e5f5',  color: '#7b1fa2' },
      medication:{ bg: E.amberLt,  color: E.amber },
      consult:   { bg: E.tealLt,   color: E.teal  },
      procedure: { bg: E.panelHd,  color: E.muted },
    };
    const s = map[cat] ?? map.procedure;
    return {
      fontSize: 10, fontWeight: 600, padding: '1px 6px',
      borderRadius: 10, background: s.bg, color: s.color,
    };
  };

  const timeColor = simTime >= 60 ? E.red : simTime >= 30 ? E.amber : E.muted;

  return (
    <div style={{ background: E.panelHd, borderTop: '1px solid ' + E.border, fontFamily: E.font }}>
      <AnimatePresence>
        {res.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
            style={{ background: E.panel, borderBottom: '1px solid ' + E.border, maxHeight: 240, overflowY: 'auto' }}
          >
            {res.map(r => (
              <button
                key={r.name}
                onMouseDown={() => place(r)}
                disabled={isBusy}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '5px 12px', background: 'none', border: 'none',
                  borderBottom: '1px solid ' + E.border, cursor: 'pointer',
                  textAlign: 'left', fontFamily: E.font, fontSize: 12,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = E.tealLt; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
              >
                <span style={{ flex: 1, color: E.text }}>{r.name}</span>
                {(r.route || r.frequency) && (
                  <span style={{ color: E.muted, fontSize: 10 }}>
                    {[r.route, r.frequency].filter(Boolean).join(' · ')}
                  </span>
                )}
                <span style={catStyle(r.category)}>{r.category}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: E.teal, letterSpacing: 0.5 }}>CPOE</span>
        <input
          type="text"
          value={val}
          onChange={e => { setVal(e.target.value); doSearch(e.target.value); }}
          onKeyDown={e => { if (e.key === 'Enter') execute(); if (e.key === 'Escape') clear(); }}
          onBlur={() => setTimeout(() => setRes([]), 150)}
          placeholder={isBusy ? 'Processing…' : 'Order, medication, procedure, or free text…'}
          disabled={isBusy || !caseId}
          style={{
            flex: 1, padding: '4px 8px', fontSize: 12,
            border: '1px solid ' + E.border,
            background: isBusy ? '#f5f5f5' : '#fff',
            fontFamily: E.font, outline: 'none',
          }}
        />
        <button
          onClick={execute}
          disabled={isBusy || !val.trim()}
          style={{
            padding: '4px 14px', fontSize: 12,
            background: E.teal, color: '#fff',
            border: 'none', cursor: 'pointer', fontFamily: E.font,
          }}
        >
          Accept
        </button>
        <div style={{ width: 1, height: 18, background: E.border, margin: '0 4px' }} />
        <button
          onClick={onOpenTimeAdvance}
          disabled={isBusy || !caseId}
          style={{ fontSize: 11, color: E.teal, background: 'none', border: '1px solid ' + E.border, padding: '3px 8px', cursor: 'pointer', fontFamily: E.font }}
        >
          ↻ Advance Time
        </button>
        <button
          onClick={onConsult}
          disabled={isBusy || !caseId}
          style={{ fontSize: 11, color: E.teal, background: 'none', border: '1px solid ' + E.border, padding: '3px 8px', cursor: 'pointer', fontFamily: E.font }}
        >
          Consult
        </button>
        {simTime > 0 && (
          <span style={{ fontSize: 11, fontFamily: E.mono, color: timeColor }}>
            T+{simTime}m
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Table style constants ─────────────────────────────────────────────────────
const thStyle: React.CSSProperties = {
  padding: '3px 8px', textAlign: 'left', fontSize: 10,
  fontWeight: 600, color: E.muted, textTransform: 'uppercase',
  borderBottom: '1px solid ' + E.border,
};
const tdStyle: React.CSSProperties = {
  padding: '3px 8px', fontSize: 11, borderBottom: '1px solid ' + E.border,
};

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

  const [chartTab, setChartTab] = useState('chart-review');
  const [timelineTab, setTimelineTab] = useState<'all' | 'events' | 'orders' | 'results'>('all');
  const [imgOpen, setImgOpen]   = useState<Record<string, boolean>>({});
  const [assessOpen, setAssessOpen] = useState(false);
  const [timeAdvOpen, setTimeAdvOpen] = useState(false);
  const [selectedPt, setSelectedPt] = useState<string | null>(null);

  const isBusy = intervening || calling;

  // Computed labs/imaging
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

  // Vitals
  const sbp = mc ? parseInt(mc.vitals.bloodPressure.split('/')[0]) || 120 : 120;

  const vData = mc ? [
    { key: 'hr',   label: 'HR',   value: mc.vitals.heartRate,        unit: 'bpm',  status: vitalStatus('hr', mc.vitals.heartRate) },
    { key: 'bp',   label: 'BP',   value: sbp,                         unit: 'mmHg', display: mc.vitals.bloodPressure, status: vitalStatus('sbp', sbp) },
    { key: 'spo2', label: 'SpO₂', value: mc.vitals.oxygenSaturation, unit: '%',    status: vitalStatus('spo2', mc.vitals.oxygenSaturation) },
    { key: 'rr',   label: 'RR',   value: mc.vitals.respiratoryRate,  unit: '/min', status: vitalStatus('rr', mc.vitals.respiratoryRate) },
    { key: 'temp', label: 'Temp', value: mc.vitals.temperature,      unit: '°C',   status: vitalStatus('temp', mc.vitals.temperature) },
  ] : [];

  // Sparkline series
  const sparkSeries = useMemo(() => {
    if (!mc) return {} as Record<string, number[]>;
    const hist: VitalsHistoryEntry[] = vitalsHistory || [];
    if (hist.length >= 2) {
      return {
        hr:   hist.map(h => h.hr),
        spo2: hist.map(h => h.spo2),
        rr:   hist.map(h => h.rr),
        temp: hist.map(h => h.rr),   // temp not in VitalsHistoryEntry; use rr proxy
        bp:   hist.map(h => h.sbp),
      };
    }
    const mock = (v: number, spread = 8): number[] =>
      Array.from({ length: 10 }, (_, i) =>
        v + Math.sin(i) * spread * 0.5 + (Math.random() - 0.5) * spread * 0.3,
      );
    return {
      hr:   mock(mc.vitals.heartRate, 15),
      spo2: mock(mc.vitals.oxygenSaturation, 3),
      rr:   mock(mc.vitals.respiratoryRate, 4),
      temp: mock(mc.vitals.temperature, 0.5),
      bp:   mock(sbp, 12),
    };
  }, [mc, vitalsHistory]);

  // Clinical events / alarms
  const clinEvents = useMemo(() => {
    if (!mc) return [] as { label: string; desc: string; level: 'critical' | 'warning' }[];
    const ev: { label: string; desc: string; level: 'critical' | 'warning' }[] = [];
    if (mc.vitals.oxygenSaturation < 88)
      ev.push({ label: 'SpO₂', desc: mc.vitals.oxygenSaturation + '% — Critical hypoxia', level: 'critical' });
    else if (mc.vitals.oxygenSaturation < 94)
      ev.push({ label: 'SpO₂', desc: mc.vitals.oxygenSaturation + '% — Below target', level: 'warning' });
    if (sbp < 80)
      ev.push({ label: 'BP', desc: mc.vitals.bloodPressure + ' — Severe hypotension', level: 'critical' });
    else if (sbp < 90)
      ev.push({ label: 'BP', desc: mc.vitals.bloodPressure + ' — Hypotension', level: 'warning' });
    if (mc.vitals.heartRate > 150)
      ev.push({ label: 'HR', desc: mc.vitals.heartRate + ' bpm — Tachycardia', level: 'critical' });
    if (mc.vitals.temperature > 38.3)
      ev.push({ label: 'Temp', desc: mc.vitals.temperature + '°C — Fever', level: 'warning' });
    availLabs.filter(l => l.status === 'critical').forEach(l =>
      ev.push({ label: l.name, desc: l.value + ' ' + l.unit + ' — Critical result', level: 'critical' }),
    );
    (mc.activeAlarms || []).forEach(a => ev.push({ label: '⚡', desc: a, level: 'warning' }));
    return ev;
  }, [mc, sbp, availLabs]);

  const activeMeds = useMemo(() =>
    (mc?.medications || []).filter(m => m.discontinuedAt === undefined),
    [mc]);

  const today = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

  // ── Auth gate ────────────────────────────────────────────────────────────────
  if (isSupabaseConfigured && !isAuthLoading && !user) {
    return (
      <div style={{ minHeight: '100vh', background: E.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: E.font }}>
        <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} isRecovery={isRecovery} onRecoveryHandled={clearRecovery} />
        <div style={{ background: E.panel, padding: 40, width: 340, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
          <div style={{ background: E.teal, color: '#fff', padding: '10px 14px', marginBottom: 24, fontSize: 16, fontWeight: 700 }}>
            <span style={{ fontStyle: 'italic', fontWeight: 900, fontSize: 22 }}>epic</span>
            <span style={{ marginLeft: 12, fontSize: 13, fontWeight: 400, opacity: 0.8 }}>Clinical Workstation</span>
          </div>
          <p style={{ fontSize: 13, color: E.textSm, marginBottom: 20 }}>Sign in to access patient records.</p>
          <button
            onClick={() => setIsAuthOpen(true)}
            style={{ padding: '7px 20px', background: E.teal, color: '#fff', border: 'none', fontSize: 13, cursor: 'pointer', fontFamily: E.font }}
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  if (isAuthLoading || loading || error) {
    return (
      <div style={{ minHeight: '100vh', background: E.bodyBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: E.font, fontSize: 13 }}>
        {error ? (
          <div style={{ background: E.panel, border: '1px solid ' + E.border, padding: 28, maxWidth: 360, textAlign: 'center' }}>
            <p style={{ color: E.red, fontWeight: 600, marginBottom: 8 }}>Connection Error</p>
            <p style={{ color: E.textSm, marginBottom: 16 }}>{error}</p>
            <button onClick={() => loadNewCase()} style={{ padding: '5px 16px', background: E.teal, color: '#fff', border: 'none', cursor: 'pointer' }}>
              Retry
            </button>
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: E.muted }}>{loadingStep || 'Loading…'}</div>
        )}
      </div>
    );
  }

  // ── Global overlays ──────────────────────────────────────────────────────────
  const overlays = (
    <>
      <CaseLibrary
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        onSelectCase={(d, c, e) => { setIsLibraryOpen(false); loadNewCase(d, c, e); }}
      />
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} isRecovery={isRecovery} onRecoveryHandled={clearRecovery} />
      <CommandPalette
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        onNavigate={() => {}}
        onNewCase={() => setIsLibraryOpen(true)}
        onConsult={handleConsult}
        hasArchive={!!user}
        onOrderTest={mc ? handleOrderTest : undefined}
        onAdminister={mc ? (med: string) => handlePerformIntervention(2, 'Administer ' + med) : undefined}
        onAdvanceTime={mc ? handleAdvanceTime : undefined}
      />
      {timeAdvOpen && mc && (
        <TimeAdvanceModal
          medicalCase={mc}
          simTime={simTime}
          intervening={intervening}
          onAdvance={handleAdvanceTime}
          onClose={() => setTimeAdvOpen(false)}
        />
      )}
      {isDxPadOpen && mc && (
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
      )}
      {/* Archive view */}
      {user && <ArchiveView user={user} />}
    </>
  );

  // ── Assessment overlay ───────────────────────────────────────────────────────
  const assessOverlay = (
    <AnimatePresence>
      {assessOpen && mc && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setAssessOpen(false); }}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
            style={{ background: E.panel, width: '90vw', maxWidth: 900, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}
          >
            <div style={{ background: E.teal, color: '#fff', padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>End Case / Assessment</span>
              <button onClick={() => setAssessOpen(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
              <AssessmentTab
                medicalCase={mc}
                simTime={simTime}
                userNotes={userNotes}
                onNotesChange={setUserNotes}
                differential={differential}
                onDifferentialChange={setDifferential}
                evaluation={evaluation}
                submitting={submitting}
                logs={logs}
                onEndCase={handleEndCase}
                onNewCase={loadNewCase}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // ── STAGE COMMIT GATE ────────────────────────────────────────────────────────
  const stageGate = mc && pendingStage ? (
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
      onCommit={fromStage => {
        const snapId = reasoning.commitStage(fromStage, simTime);
        if (snapId && pendingStage) {
          reasoning.goToStage(pendingStage);
          setPendingStage(null);
        }
        return snapId;
      }}
      onCancel={() => setPendingStage(null)}
    />
  ) : null;

  // ── MAIN LAYOUT ──────────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: E.font, fontSize: 12, background: E.bodyBg, color: E.text }}>
      {overlays}
      {assessOverlay}
      {stageGate}

      {/* TOP NAV */}
      <header style={{ background: E.teal, color: '#fff', height: 32, display: 'flex', alignItems: 'center', padding: '0 10px', flexShrink: 0 }}>
        <span style={{ fontStyle: 'italic', fontWeight: 900, fontSize: 18, letterSpacing: -0.5, marginRight: 16 }}>epic</span>
        {['Appboard', 'Patient Lists', 'Routed', 'My Basket', 'Scan Team', 'Chart Room', 'Analytics', 'References', 'Manage'].map(item => (
          <button
            key={item}
            onClick={item === 'Patient Lists' ? () => setIsLibraryOpen(true) : undefined}
            style={{ padding: '0 9px', height: 32, background: 'none', border: 'none', color: 'rgba(255,255,255,0.88)', fontSize: 11, cursor: 'pointer', borderRight: '1px solid rgba(255,255,255,0.15)', whiteSpace: 'nowrap' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.2)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
          >
            {item}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => setIsCommandOpen(true)} style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '2px 8px', cursor: 'pointer', fontSize: 10, fontFamily: E.font }}>⌘K</button>
          {user && <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>{user.email?.split('@')[0]}</span>}
          <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 10, textDecoration: 'underline' }}>Sign Out</button>
          <span style={{ fontFamily: E.mono, fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>{today}</span>
        </div>
      </header>

      {/* BODY */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* LEFT SIDEBAR */}
        <aside style={{ width: 178, flexShrink: 0, background: E.panel, borderRight: '1px solid ' + E.borderDk, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <div style={{ background: E.teal, color: '#fff', padding: '4px 8px', fontSize: 11, fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <span>Patient List</span>
            <button onClick={() => setIsLibraryOpen(true)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', fontSize: 9, padding: '1px 5px', cursor: 'pointer' }}>+ New</button>
          </div>

          <SidebarGroup label="3A Patients" color="#2196f3" />
          {MOCK_PATIENTS.filter(p => p.room.startsWith('3A')).map(p => (
            <SidebarPatient
              key={p.name}
              patient={p}
              selected={selectedPt === p.name}
              onClick={() => setSelectedPt(p.name)}
            />
          ))}

          {mc && (
            <>
              <SidebarGroup label="Current Case" color={E.teal} />
              <SidebarPatient
                patient={{
                  name: mc.patientName.includes(',')
                    ? mc.patientName
                    : mc.patientName.split(' ').slice(-1)[0] + ', ' + mc.patientName.split(' ').slice(0, -1).join(' '),
                  age: mc.age + (mc.gender ? mc.gender[0] : ''),
                  status: mc.physiologicalTrend === 'critical' ? 'critical'
                    : mc.physiologicalTrend === 'declining' ? 'abnormal'
                    : 'stable',
                  room: (mc.currentLocation || 'ED-1').slice(0, 6),
                }}
                selected
                onClick={() => {}}
              />
            </>
          )}

          <SidebarGroup label="ICU Patients" color="#f44336" />
          {MOCK_PATIENTS.filter(p => p.room.startsWith('ICU')).map(p => (
            <SidebarPatient key={p.name} patient={p} selected={false} onClick={() => setSelectedPt(p.name)} />
          ))}

          <SidebarGroup label="3C Patients" color="#4caf50" />
          {MOCK_PATIENTS.filter(p => p.room.startsWith('3C')).map(p => (
            <SidebarPatient key={p.name} patient={p} selected={false} onClick={() => setSelectedPt(p.name)} />
          ))}

          <div style={{ flex: 1 }} />
          <div style={{ borderTop: '1px solid ' + E.border, padding: '4px 0' }}>
            {['Follow Up', 'Referrals', 'Quick Links'].map(label => (
              <div
                key={label}
                style={{ padding: '4px 10px', fontSize: 11, color: E.teal, cursor: 'pointer', borderBottom: '1px solid ' + E.border }}
                onMouseEnter={e => { e.currentTarget.style.background = E.tealLt; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
              >
                {label}
              </div>
            ))}
          </div>
        </aside>

        {/* CHART AREA */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {!mc ? (
            /* No patient loaded */
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: E.bodyBg }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: E.muted, marginBottom: 16 }}>No patient selected</p>
                <button onClick={() => loadNewCase()} style={{ padding: '6px 18px', background: E.teal, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontFamily: E.font }}>
                  Generate Case
                </button>
                <button onClick={() => setIsLibraryOpen(true)} style={{ padding: '6px 18px', background: 'none', color: E.teal, border: '1px solid ' + E.teal, cursor: 'pointer', fontSize: 12, fontFamily: E.font, marginLeft: 8 }}>
                  Browse Library
                </button>
              </div>
            </div>
          ) : (
            /* Patient loaded */
            <>
              {/* PATIENT HEADER BAND */}
              <div style={{ background: E.teal, color: '#fff', padding: '5px 10px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 2 }}>
                      <span style={{ fontWeight: 700, fontSize: 17, letterSpacing: -0.3 }}>
                        {mc.patientName.includes(',')
                          ? mc.patientName
                          : mc.patientName.split(' ').slice(-1)[0] + ', ' + mc.patientName.split(' ').slice(0, -1).join(' ')}
                      </span>
                      {mc.difficulty && (
                        <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.2)', padding: '1px 6px', borderRadius: 2 }}>
                          {mc.difficulty.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.82)', display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 1 }}>
                      <span>Age: <strong style={{ color: '#fff' }}>{mc.age} y/o {mc.gender}</strong></span>
                      <span>MRN: <strong style={{ color: '#fff' }}>{mc.id.slice(-8).toUpperCase()}</strong></span>
                      <span>Code: <strong style={{ color: '#fff' }}>Full Code</strong></span>
                      {(mc.specialty_tags || []).length > 0 && (
                        <span>Specialty: <strong style={{ color: '#c8e8ff' }}>{(mc.specialty_tags || []).join(', ')}</strong></span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.82)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <span>Location: <strong style={{ color: '#fff' }}>{mc.currentLocation}</strong></span>
                      {mc.physiologicalTrend && mc.physiologicalTrend !== 'stable' && (
                        <span style={{
                          background: mc.physiologicalTrend === 'improving' ? '#1a6e2e' : '#8b1a1a',
                          padding: '0 6px', borderRadius: 2, color: '#fff', fontWeight: 600,
                        }}>
                          {mc.physiologicalTrend === 'improving' ? '↑' : mc.physiologicalTrend === 'critical' ? '⚠' : '↓'} {mc.physiologicalTrend.toUpperCase()}
                        </span>
                      )}
                      {patientOutcome && patientOutcome !== 'alive' && (
                        <span style={{
                          background: patientOutcome === 'deceased' ? '#111' : '#8b0000',
                          padding: '0 8px', borderRadius: 2, color: '#fff', fontWeight: 700,
                        }}>
                          {patientOutcome === 'deceased' ? '✕ EXPIRED' : '⚠ DETERIORATING'}
                        </span>
                      )}
                    </div>
                  </div>
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

              {/* SECONDARY CHART TABS */}
              <div style={{ background: E.tabBar, display: 'flex', borderBottom: '2px solid ' + E.borderDk, flexShrink: 0 }}>
                {['Chart Review', 'Flowsheet', 'Medications', 'Plan', 'Notes', 'Orders', 'Results'].map(tab => {
                  const key = tab.toLowerCase().replace(' ', '-');
                  const active = chartTab === key;
                  return (
                    <button
                      key={tab}
                      onClick={() => setChartTab(key)}
                      style={{
                        padding: '5px 12px', fontSize: 11, fontFamily: E.font, cursor: 'pointer',
                        background: active ? E.panel : 'transparent',
                        border: 'none', borderRight: '1px solid ' + E.border,
                        borderBottom: active ? '2px solid ' + E.panel : 'none',
                        color: active ? E.teal : E.textSm,
                        fontWeight: active ? 600 : 400,
                        marginBottom: active ? -2 : 0,
                      }}
                    >
                      {tab}
                    </button>
                  );
                })}
                <div style={{ flex: 1 }} />
                <button onClick={() => setIsDxPadOpen(p => !p)} style={{ padding: '4px 10px', fontSize: 10, background: 'none', border: 'none', color: E.teal, cursor: 'pointer', fontFamily: E.font }}>
                  Dx Pad
                </button>
              </div>

              {/* VITALS STRIP */}
              <div style={{ background: E.panel, borderBottom: '1px solid ' + E.border, padding: '6px 10px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: E.muted, marginRight: 10, letterSpacing: 0.5, whiteSpace: 'nowrap' }}>
                    {'VITALS' + (simTime > 0 ? ' Last ' + simTime + 'm' : '')}
                  </span>
                  {vData.map(vd => {
                    const spark = (sparkSeries[vd.key as keyof typeof sparkSeries] as number[] | undefined) || [];
                    const col = statusColor(vd.status);
                    return (
                      <div key={vd.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 10px', borderRight: '1px solid ' + E.border, minWidth: 100 }}>
                        <div style={{ fontSize: 9, fontWeight: 600, color: E.muted, letterSpacing: 0.5, textTransform: 'uppercase' as const, marginBottom: 1 }}>
                          {vd.label}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Sparkline values={spark} color={col} />
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: col, lineHeight: 1, fontFamily: E.mono }}>
                              {vd.display ?? vd.value}
                            </div>
                            <div style={{ fontSize: 9, color: E.muted }}>{vd.unit}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 4-COLUMN CONTENT GRID */}
              <div style={{ flex: 1, display: 'flex', overflow: 'hidden', gap: 0 }}>

                {/* COL 1 — Timeline */}
                <div style={{ width: 220, flexShrink: 0, borderRight: '1px solid ' + E.border, display: 'flex', flexDirection: 'column', overflowY: 'auto', background: E.panel }}>
                  <SectionHead title="Timeline" />
                  <div style={{ display: 'flex', background: E.panelHd, borderBottom: '1px solid ' + E.border }}>
                    {(['all', 'events', 'orders', 'results'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setTimelineTab(t)}
                        style={{
                          flex: 1, padding: '4px 0', fontSize: 10, border: 'none', cursor: 'pointer',
                          background: timelineTab === t ? E.panel : 'transparent',
                          color: timelineTab === t ? E.teal : E.muted,
                          fontWeight: timelineTab === t ? 600 : 400, fontFamily: E.font,
                        }}
                      >
                        {t[0].toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    {[...(logs || [])].reverse()
                      .filter(log => {
                        if (timelineTab === 'all') return true;
                        if (timelineTab === 'events') return log.text.startsWith('ACTION:') || log.text.startsWith('WAIT');
                        if (timelineTab === 'orders') return log.text.startsWith('ORDER:') || log.text.startsWith('D/C:');
                        if (timelineTab === 'results') return log.text.startsWith('ORDER: ') && (log.text.toLowerCase().includes('lab') || log.text.toLowerCase().includes('imaging'));
                        return true;
                      })
                      .map((log, i) => {
                        const typeColor = log.text.startsWith('ACTION:') || log.text.startsWith('WAIT') ? E.amber
                          : log.text.startsWith('D/C:') ? E.red
                          : E.teal;
                        return (
                          <div key={i} style={{ padding: '5px 8px', borderBottom: '1px solid ' + E.border }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: typeColor, flexShrink: 0, marginTop: 3 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: 10, color: E.muted, margin: '0 0 1px' }}>{log.time}</p>
                                <p style={{ fontSize: 11, color: E.text, margin: 0, wordBreak: 'break-word' }}>{log.text}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    {(logs || []).length === 0 && (
                      <p style={{ padding: '10px 8px', color: E.muted, fontSize: 11, textAlign: 'center' }}>No activity yet</p>
                    )}
                  </div>
                </div>

                {/* COL 2 — Patient Summary */}
                <div style={{ width: 260, flexShrink: 0, borderRight: '1px solid ' + E.border, display: 'flex', flexDirection: 'column', overflowY: 'auto', background: E.panel }}>
                  <SectionHead title="Patient Summary" />

                  <SubHead label="Chief Complaint / HPI" />
                  <div style={{ padding: '6px 10px', fontSize: 11, color: E.text, lineHeight: 1.5 }}>
                    {mc.chiefComplaint}
                  </div>
                  {mc.historyOfPresentIllness && (
                    <div style={{ padding: '0 10px 8px', fontSize: 11, color: E.textSm, lineHeight: 1.5 }}>
                      {mc.historyOfPresentIllness}
                    </div>
                  )}

                  <SubHead label="PMH / Social" />
                  <div style={{ padding: '4px 10px' }}>
                    {(mc.pastMedicalHistory || []).length > 0 ? (
                      (mc.pastMedicalHistory || []).map((pmh, i) => (
                        <div key={i} style={{ fontSize: 11, color: E.text, padding: '1px 0', borderBottom: '1px solid ' + E.border }}>
                          {pmh}
                        </div>
                      ))
                    ) : (
                      <p style={{ fontSize: 11, color: E.muted, margin: 0 }}>None reported</p>
                    )}
                  </div>

                  <SubHead label="Active Medications" />
                  <div style={{ padding: '4px 10px' }}>
                    {activeMeds.length > 0 ? activeMeds.map((med, i) => (
                      <div key={i} style={{ fontSize: 11, padding: '2px 0', borderBottom: '1px solid ' + E.border, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: E.text }}>{med.name}</span>
                        <button
                          onClick={() => handleDiscontinueMedication(med.id, med.name)}
                          disabled={isBusy}
                          style={{ fontSize: 9, color: E.red, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        >
                          D/C
                        </button>
                      </div>
                    )) : (
                      <p style={{ fontSize: 11, color: E.muted, margin: 0 }}>No active medications</p>
                    )}
                  </div>

                  {consultantAdvice && (
                    <>
                      <SubHead label="Consultant Advice" />
                      <div style={{ padding: '6px 10px', fontSize: 11, color: E.textSm, lineHeight: 1.5, background: E.tealLt, borderBottom: '1px solid ' + E.border }}>
                        {isConsulting ? (
                          <span style={{ color: E.muted }}>Consulting…</span>
                        ) : consultantAdvice?.advice}
                      </div>
                    </>
                  )}
                </div>

                {/* COL 3 — Labs, Exam, Imaging */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: E.panel, borderRight: '1px solid ' + E.border }}>
                  <SectionHead title="Chart" />
                  <div style={{ flex: 1, overflowY: 'auto' }}>

                    {/* Latest Labs */}
                    <SubHead label="Latest Labs" />
                    {availLabs.length > 0 ? (
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            <th style={thStyle}>Test</th>
                            <th style={thStyle}>Result</th>
                            <th style={thStyle}>Ref</th>
                            <th style={thStyle}>Flag</th>
                          </tr>
                        </thead>
                        <tbody>
                          {availLabs.map(lab => {
                            const { code, color, bg } = labFlagInfo(lab);
                            return (
                              <tr key={lab.name} style={{ background: lab.status === 'critical' ? E.redLt : lab.status === 'abnormal' ? '#fffdf0' : 'transparent' }}>
                                <td style={tdStyle}>{lab.name}</td>
                                <td style={{ ...tdStyle, fontFamily: E.mono, color: color, fontWeight: lab.status !== 'normal' ? 600 : 400 }}>
                                  {lab.value} {lab.unit}
                                </td>
                                <td style={{ ...tdStyle, color: E.muted }}>{lab.normalRange}</td>
                                <td style={{ ...tdStyle }}>
                                  {code && (
                                    <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 2, background: bg, color: color }}>
                                      {code}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    ) : (
                      <p style={{ padding: '8px 10px', color: E.muted, fontSize: 11 }}>No labs available yet</p>
                    )}
                    {pendLabs.length > 0 && (
                      <div style={{ padding: '4px 10px', fontSize: 10, color: E.muted, background: E.panelHd }}>
                        {pendLabs.length} pending: {pendLabs.map(l => l.name + ' ETA T+' + l.availableAt + 'm').join(', ')}
                      </div>
                    )}

                    {/* Physical Exam */}
                    <SubHead label="Physical Exam" />
                    {mc.physicalExam && Object.keys(mc.physicalExam).length > 0 ? (
                      <div style={{ padding: '4px 0' }}>
                        {Object.entries(mc.physicalExam).map(([sys, find]) => (
                          <div key={sys} style={{ borderBottom: '1px solid ' + E.border }}>
                            <button
                              onClick={() => setImgOpen(prev => ({ ...prev, [sys]: !prev[sys] }))}
                              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: E.font }}
                            >
                              <span style={{ fontSize: 9, color: E.muted }}>{imgOpen[sys] ? '▾' : '▸'}</span>
                              <span style={{ fontSize: 10, fontWeight: 600, color: E.textSm, textTransform: 'uppercase' as const, flex: 1 }}>{sys}</span>
                            </button>
                            {imgOpen[sys] && (
                              <div style={{ padding: '2px 10px 6px 22px', fontSize: 11, color: E.text, lineHeight: 1.5 }}>
                                {find as string}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ padding: '8px 10px', color: E.muted, fontSize: 11 }}>No exam documented</p>
                    )}

                    {/* Imaging */}
                    <SubHead label="Imaging" />
                    {availImgs.length > 0 ? availImgs.map(img => (
                      <div key={img.type} style={{ borderBottom: '1px solid ' + E.border }}>
                        <div style={{ padding: '5px 10px', fontSize: 11, fontWeight: 600, color: E.textSm }}>
                          {img.type}
                        </div>
                        <div style={{ padding: '0 10px 6px', fontSize: 11, color: E.text, lineHeight: 1.5 }}>
                          {img.impression || img.findings}
                        </div>
                      </div>
                    )) : (
                      <p style={{ padding: '8px 10px', color: E.muted, fontSize: 11 }}>No imaging available</p>
                    )}
                    {pendImgs.length > 0 && (
                      <div style={{ padding: '4px 10px', fontSize: 10, color: E.muted, background: E.panelHd }}>
                        {pendImgs.map(i => i.type + ' ETA T+' + i.availableAt + 'm').join(', ')} pending
                      </div>
                    )}
                  </div>
                </div>

                {/* COL 4 — Events, Orders, Tasks */}
                <div style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: E.panel }}>
                  <SectionHead title="Active Events" />

                  {/* Clinical events */}
                  <div style={{ maxHeight: 140, overflowY: 'auto', borderBottom: '1px solid ' + E.border }}>
                    {clinEvents.length > 0 ? clinEvents.map((ev, i) => (
                      <div
                        key={i}
                        style={{
                          padding: '4px 8px', borderBottom: '1px solid ' + E.border,
                          background: ev.level === 'critical' ? E.redLt : E.amberLt,
                          display: 'flex', alignItems: 'flex-start', gap: 6,
                        }}
                      >
                        <span style={{ fontSize: 9, fontWeight: 700, color: ev.level === 'critical' ? E.red : E.amber, minWidth: 28 }}>
                          {ev.label}
                        </span>
                        <span style={{ fontSize: 10, color: E.text, lineHeight: 1.3 }}>{ev.desc}</span>
                      </div>
                    )) : (
                      <p style={{ padding: '6px 8px', fontSize: 11, color: E.muted, textAlign: 'center' }}>No active alerts</p>
                    )}
                  </div>

                  <SubHead label="Orders" />
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    {[...(mc.clinicalActions || [])].reverse().slice(0, 12).map((action, i) => {
                      const badge = Object.entries({ medication: 'Rx', exam: 'Exam', procedure: 'Proc', order: 'Ord', communication: 'Comm', 'time-advance': 'Time' })
                        .find(([k]) => action.type?.includes(k));
                      return (
                        <div key={i} style={{ padding: '4px 8px', borderBottom: '1px solid ' + E.border, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                          <span style={{ fontSize: 9, background: E.tealLt, color: E.teal, padding: '1px 4px', borderRadius: 2, flexShrink: 0, fontWeight: 600 }}>
                            {badge ? badge[1] : 'Act'}
                          </span>
                          <p style={{ fontSize: 11, color: E.text, margin: 0, flex: 1, wordBreak: 'break-word' }}>{action.description}</p>
                        </div>
                      );
                    })}
                    {(mc.clinicalActions || []).length === 0 && (
                      <p style={{ padding: '6px 8px', fontSize: 11, color: E.muted, textAlign: 'center' }}>No orders yet</p>
                    )}
                  </div>

                  <SubHead label="To Do / Tasks" />
                  <div style={{ padding: '4px 8px', fontSize: 11 }}>
                    {[
                      { done: (mc.labs || []).length > 0,     text: 'Order initial labs' },
                      { done: (mc.clinicalActions || []).length > 2, text: 'Perform assessment' },
                      { done: !!consultantAdvice,              text: 'Consult specialist' },
                    ].map(task => (
                      <div key={task.text} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', borderBottom: '1px solid ' + E.border }}>
                        <span style={{ color: task.done ? E.green : E.muted, fontSize: 13 }}>{task.done ? '✓' : '○'}</span>
                        <span style={{ color: task.done ? E.muted : E.text, textDecoration: task.done ? 'line-through' : 'none' }}>{task.text}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>{/* end 4-col grid */}

              {/* CPOE BAR */}
              <CPOEBar
                caseId={mc.id}
                simTime={simTime}
                busy={isBusy}
                onExecute={t => handlePerformIntervention(2, t)}
                onOpenTimeAdvance={() => setTimeAdvOpen(true)}
                onOrderTest={handleOrderTest}
                onConsult={handleConsult}
              />
            </>
          )}
        </div>{/* end chart area */}
      </div>{/* end body */}
    </div>
  );
}
