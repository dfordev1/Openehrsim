/**
 * ClinicalLayout — modern clinical UI.
 * Slate palette · system-ui · shadow cards · underline tabs · pill badges.
 */

import * as Sentry from '@sentry/react';
import React, {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCase } from '../contexts/CaseContext';
import { useNavigation } from '../contexts/NavigationContext';
import { AuthModal } from './Auth';
import { CaseLibrary } from './CaseLibrary';
import { CommandPalette } from './CommandPalette';
import { AssessmentTab } from './tabs/AssessmentTab';
import { ArchiveView } from './ArchiveView';
import { DiagnosisPad } from './DiagnosisPad';
import { StageCommitGate } from './StageCommitGate';
import type { LabResult, MedicalCase, AvailableTest } from '../types';

// ─── design tokens ─────────────────────────────────────────────────────────────
const T = {
  // surfaces
  bg:       '#f1f5f9',
  card:     '#ffffff',
  header:   '#0f172a',
  subhead:  '#1e293b',
  // borders
  border:   '#e2e8f0',
  borderMd: '#cbd5e1',
  // text
  text:     '#0f172a',
  textSm:   '#334155',
  muted:    '#64748b',
  // accent
  indigo:   '#4f46e5',
  indigoLt: '#eef2ff',
  // status
  red:      '#ef4444',
  redLt:    '#fef2f2',
  redBd:    '#fecaca',
  amber:    '#d97706',
  amberLt:  '#fffbeb',
  amberBd:  '#fde68a',
  emerald:  '#059669',
  emeraldLt:'#ecfdf5',
  blue:     '#2563eb',
  blueLt:   '#eff6ff',
  purple:   '#7c3aed',
  purpleLt: '#f5f3ff',
  // font
  sans: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  mono: '"JetBrains Mono", "Fira Code", "Cascadia Code", Consolas, monospace',
};

// ─── vitals analysis ───────────────────────────────────────────────────────────
function vitalsAbnormal(mc: MedicalCase) {
  const v = mc.vitals;
  const sbp = parseInt(mc.vitals.bloodPressure.split('/')[0]) || 120;
  return {
    hr:    v.heartRate > 100 || v.heartRate < 60,
    hrCrit:v.heartRate > 150 || v.heartRate < 40,
    bp:    sbp > 140 || sbp < 90,
    bpCrit:sbp > 180 || sbp < 80,
    rr:    v.respiratoryRate > 20 || v.respiratoryRate < 12,
    rrCrit:v.respiratoryRate > 30 || v.respiratoryRate < 8,
    spo2:  v.oxygenSaturation < 95,
    spo2Crit: v.oxygenSaturation < 88,
    temp:  v.temperature > 38.3 || v.temperature < 36,
    tempCrit: v.temperature > 40 || v.temperature < 34,
  };
}

// ─── lab flag ──────────────────────────────────────────────────────────────────
function labFlag(lab: LabResult) {
  if (lab.status === 'critical') {
    const v = parseFloat(String(lab.value));
    const parts = lab.normalRange.split('-');
    const lo = parseFloat(parts[0]);
    const isLow = !isNaN(v) && !isNaN(lo) && v < lo;
    return isLow
      ? { code: 'LL', color: T.blue,   bg: T.blueLt }
      : { code: 'HH', color: T.red,    bg: T.redLt  };
  }
  if (lab.status === 'abnormal') {
    const v = parseFloat(String(lab.value));
    const parts = lab.normalRange.split('-');
    const lo = parseFloat(parts[0]), hi = parseFloat(parts[parts.length - 1]);
    if (!isNaN(v) && !isNaN(lo) && !isNaN(hi))
      return v < lo
        ? { code: 'L', color: T.blue,   bg: T.blueLt  }
        : { code: 'H', color: T.amber,  bg: T.amberLt };
    return { code: 'H', color: T.amber, bg: T.amberLt };
  }
  return { code: '', color: T.emerald, bg: 'transparent' };
}

// ─── action badge colours ──────────────────────────────────────────────────────
const actionBadge: Record<string, { bg: string; color: string; label: string }> = {
  order:         { bg: T.blueLt,   color: T.blue,    label: 'Order'    },
  medication:    { bg: T.emeraldLt,color: T.emerald,  label: 'Meds'     },
  exam:          { bg: T.purpleLt, color: T.purple,   label: 'Exam'     },
  procedure:     { bg: T.amberLt,  color: T.amber,    label: 'Procedure'},
  transfer:      { bg: T.redLt,    color: T.red,      label: 'Transfer' },
  communication: { bg: T.indigoLt, color: T.indigo,   label: 'Comms'    },
  'time-advance':{ bg: '#f8fafc',  color: T.muted,    label: 'Time'     },
};

// ─── Error Boundary ────────────────────────────────────────────────────────────
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(e: Error, i: ErrorInfo) { Sentry.captureException(e, { extra: { componentStack: i.componentStack } }); }
  render() {
    if (this.state.hasError) return (
      <div style={{ padding: 48, fontFamily: T.sans, fontSize: 14, color: T.text }}>
        <p style={{ fontWeight: 600, marginBottom: 8 }}>Something went wrong.</p>
        <button onClick={() => window.location.reload()} style={btn('md')}>Reload</button>
      </div>
    );
    return this.props.children;
  }
}

export { ErrorBoundary };
export function ClinicalLayout() { return <ErrorBoundary><Shell /></ErrorBoundary>; }

type Tab = 'chart' | 'orders' | 'results' | 'mar' | 'consult' | 'assessment';

// ─── Shell ─────────────────────────────────────────────────────────────────────
function Shell() {
  const { user, isAuthOpen, setIsAuthOpen, handleLogout, isSupabaseConfigured, isAuthLoading, isRecovery, clearRecovery } = useAuth();

  const {
    medicalCase, loading, error, loadingStep, patientOutcome,
    consultantAdvice, isConsulting, setIsConsultOpen,
    intervening, userNotes, setUserNotes, evaluation, submitting,
    differential, setDifferential, calling, logs, reasoning,
    isDxPadOpen, setIsDxPadOpen, dxPadInitialTab,
    pendingStage, setPendingStage,
    loadNewCase, handlePerformIntervention, handleConsult,
    handleOrderTest, handleDiscontinueMedication,
    handleAdvanceTime, handleEndCase, setMedicalCase, simTime,
  } = useCase();

  const { isLibraryOpen, setIsLibraryOpen, isCommandOpen, setIsCommandOpen } = useNavigation();

  const [tab, setTab] = useState<Tab>('chart');
  const [orderInput, setOrderInput] = useState('');
  const [urgency, setUrgency] = useState<'STAT' | 'Routine'>('STAT');
  const [advanceMin, setAdvanceMin] = useState(15);
  const [examOpen, setExamOpen] = useState<Record<string, boolean>>({});
  const [imgOpen, setImgOpen] = useState<Record<string, boolean>>({});
  const [suggestions, setSuggestions] = useState<(AvailableTest & { _kind: 'lab' | 'imaging' })[]>([]);
  const [acOpen, setAcOpen] = useState(false);
  const [critDismissed, setCritDismissed] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const prevLabCount = useRef(0);

  // ─ Autocomplete ──────────────────────────────────────────────────────────────
  const allTests = useMemo(() => {
    if (!medicalCase?.availableTests) return [];
    const ordered = new Set([
      ...(medicalCase.labs || []).map(l => l.name.toLowerCase()),
      ...(medicalCase.imaging || []).map(i => i.type.toLowerCase()),
    ]);
    return [
      ...(medicalCase.availableTests.labs || [])
        .filter(t => !ordered.has(t.name.toLowerCase()))
        .map(t => ({ ...t, _kind: 'lab' as const })),
      ...(medicalCase.availableTests.imaging || [])
        .filter(t => !ordered.has(t.name.toLowerCase()))
        .map(t => ({ ...t, _kind: 'imaging' as const })),
    ];
  }, [medicalCase]);

  const search = useCallback((q: string) => {
    if (!q.trim()) { setSuggestions([]); setAcOpen(false); return; }
    const r = allTests.filter(t => t.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
    setSuggestions(r);
    setAcOpen(r.length > 0);
  }, [allTests]);

  // ─ Quick chips ────────────────────────────────────────────────────────────────
  const quickLabs = useMemo(() =>
    (medicalCase?.availableTests?.labs || [])
      .filter(t => !(medicalCase?.labs || []).some(l => l.name.toLowerCase() === t.name.toLowerCase()))
      .slice(0, 5),
    [medicalCase]);
  const quickImgs = useMemo(() =>
    (medicalCase?.availableTests?.imaging || [])
      .filter(t => !(medicalCase?.imaging || []).some(i => i.type.toLowerCase() === t.name.toLowerCase()))
      .slice(0, 3),
    [medicalCase]);

  // ─ Critical result alerts ─────────────────────────────────────────────────────
  const newCrits = useMemo(() => {
    if (!medicalCase) return [];
    return (medicalCase.labs || [])
      .filter(l => l.availableAt !== undefined && l.availableAt <= simTime && l.status === 'critical' && !critDismissed.has(l.name));
  }, [medicalCase, simTime, critDismissed]);

  const availLabCount = medicalCase
    ? (medicalCase.labs || []).filter(l => l.availableAt !== undefined && l.availableAt <= simTime).length
    : 0;
  const hasNewResult = availLabCount > prevLabCount.current;
  useEffect(() => { prevLabCount.current = availLabCount; }, [availLabCount]);

  // ─ Auth gate ──────────────────────────────────────────────────────────────────
  if (isSupabaseConfigured && !isAuthLoading && !user) {
    return (
      <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.sans }}>
        <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} isRecovery={isRecovery} onRecoveryHandled={clearRecovery} />
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 40, width: 360, boxShadow: '0 4px 24px rgba(0,0,0,0.07)' }}>
          <div style={{ fontWeight: 700, fontSize: 20, color: T.text, marginBottom: 8 }}>OpenEHR Sim</div>
          <div style={{ color: T.muted, fontSize: 14, marginBottom: 28 }}>Clinical decision support workstation</div>
          <button onClick={() => setIsAuthOpen(true)} style={btn('lg')}>Sign In</button>
        </div>
      </div>
    );
  }

  if (isAuthLoading || loading || error) {
    return (
      <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.sans }}>
        {error ? (
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 32, maxWidth: 380, textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.07)' }}>
            <div style={{ color: T.red, fontWeight: 600, marginBottom: 8 }}>System error</div>
            <div style={{ color: T.textSm, marginBottom: 20, fontSize: 14 }}>{error}</div>
            <button onClick={() => loadNewCase()} style={btn('md')}>Retry</button>
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: T.muted, fontSize: 14 }}>
            <Spinner />
            <div style={{ marginTop: 12 }}>{loadingStep || 'Loading…'}</div>
          </div>
        )}
      </div>
    );
  }

  const mc = medicalCase;
  const isBusy = intervening || calling;
  const abn = mc ? vitalsAbnormal(mc) : null;
  const activeMeds = (mc?.medications || []).filter(m => m.discontinuedAt === undefined);
  const discMeds   = (mc?.medications || []).filter(m => m.discontinuedAt !== undefined);
  const availLabs  = (mc?.labs || []).filter(l => l.availableAt !== undefined && l.availableAt <= simTime);
  const pendLabs   = (mc?.labs || []).filter(l => l.availableAt !== undefined && l.availableAt > simTime);
  const availImgs  = (mc?.imaging || []).filter(i => i.availableAt !== undefined && i.availableAt <= simTime);
  const pendImgs   = (mc?.imaging || []).filter(i => i.availableAt !== undefined && i.availableAt > simTime);
  const critCount  = availLabs.filter(l => l.status === 'critical').length;
  const resultCount = availLabs.length + availImgs.length;

  function submitOrder() {
    const v = orderInput.trim();
    if (!v || isBusy || !mc) return;
    setOrderInput('');
    setSuggestions([]);
    setAcOpen(false);
    handlePerformIntervention(urgency === 'STAT' ? 2 : 5, v);
  }

  function placeTest(t: AvailableTest & { _kind: 'lab' | 'imaging' }) {
    handleOrderTest(t._kind, t.name);
    setSuggestions([]);
    setAcOpen(false);
    setOrderInput('');
  }

  function examineAll() {
    if (!mc) return;
    const locked = Object.entries(mc.physicalExam || {}).filter(([, v]) => v === '[[LOCKED]]').map(([k]) => k);
    if (!locked.length) return;
    setMedicalCase(prev => prev ? { ...prev, clinicalActions: [...(prev.clinicalActions || []), ...locked.map((s, i) => ({ id: `exam-all-${Date.now()}-${i}`, timestamp: prev.simulationTime, type: 'exam' as const, description: `Performed physical exam: ${s}` }))] } : prev);
    setExamOpen(Object.fromEntries(locked.map(k => [k, true])));
    handlePerformIntervention(3, 'Complete physical examination performed');
  }

  const timeColor = simTime >= 60 ? T.red : simTime >= 30 ? T.amber : T.emerald;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: T.sans, fontSize: 13, background: T.bg, color: T.text }}>

      {/* Global overlays */}
      <CaseLibrary isOpen={isLibraryOpen} onClose={() => setIsLibraryOpen(false)} onSelectCase={(d, c, e) => { setIsLibraryOpen(false); loadNewCase(d, c, e); }} />
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} isRecovery={isRecovery} onRecoveryHandled={clearRecovery} />
      <CommandPalette isOpen={isCommandOpen} onClose={() => setIsCommandOpen(false)} onNavigate={() => {}} onNewCase={() => setIsLibraryOpen(true)} onConsult={handleConsult} hasArchive={!!user} onOrderTest={mc ? handleOrderTest : undefined} onAdminister={mc ? (med) => handlePerformIntervention(2, `Administer ${med}`) : undefined} onAdvanceTime={mc ? handleAdvanceTime : undefined} />

      {/* ── App header ── */}
      <header style={{ background: T.header, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', height: 44, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: -0.3 }}>OpenEHR Sim</span>
          <span style={{ color: '#475569', fontSize: 11, fontWeight: 500, letterSpacing: 0.5, textTransform: 'uppercase' }}>Clinical Workstation</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <HeaderBtn onClick={() => setIsLibraryOpen(true)}>New Case</HeaderBtn>
          <HeaderBtn onClick={() => setIsCommandOpen(true)}>⌘K Commands</HeaderBtn>
          {mc && <HeaderBtn onClick={() => setIsDxPadOpen(p => !p)}>Dx Pad</HeaderBtn>}
          {user && <span style={{ color: '#64748b', fontSize: 12, marginLeft: 8 }}>{user.email} · <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 12, padding: 0, textDecoration: 'underline' }}>Sign out</button></span>}
        </div>
      </header>

      {!mc ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', maxWidth: 420 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏥</div>
            <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>No patient loaded</div>
            <div style={{ color: T.muted, marginBottom: 28 }}>Select a case from the library or generate a new one to begin your simulation.</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setIsLibraryOpen(true)} style={btn('lg')}>Browse Cases</button>
              <button onClick={() => loadNewCase()} style={btn('lg', 'ghost')}>Generate New</button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* ── Patient banner ── */}
          <div style={{ background: T.subhead, color: '#fff', padding: '10px 16px', flexShrink: 0, display: 'flex', gap: 0, flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: -0.3 }}>{mc.patientName}</span>
              <span style={{ color: '#94a3b8', fontSize: 13 }}>{mc.age} y/o {mc.gender}</span>
              <span style={{ color: '#475569', fontSize: 12 }}>MRN {mc.id.slice(-8).toUpperCase()}</span>
              {mc.difficulty && <Pill color={T.indigo} bg={T.indigoLt} style={{ color: '#c7d2fe' }}>{mc.difficulty}</Pill>}
              {mc.category && <Pill color="#475569" bg="#1e293b" style={{ color: '#94a3b8', border: '1px solid #334155' }}>{mc.category.replace(/_/g, ' ')}</Pill>}
              {mc.physiologicalTrend && mc.physiologicalTrend !== 'stable' && (
                <span style={{ background: mc.physiologicalTrend === 'improving' ? '#064e3b' : '#7f1d1d', color: mc.physiologicalTrend === 'improving' ? '#6ee7b7' : '#fca5a5', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                  {mc.physiologicalTrend === 'improving' ? '↑' : '↓'} {mc.physiologicalTrend}
                </span>
              )}
              {patientOutcome && patientOutcome !== 'alive' && (
                <span style={{ background: patientOutcome === 'deceased' ? '#1c1917' : '#7f1d1d', color: '#fff', padding: '2px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                  {patientOutcome === 'deceased' ? '✕ Expired' : '⚠ Critical deterioration'}
                </span>
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>Sim time</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: timeColor, fontFamily: T.mono }}>T+{simTime}m</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#94a3b8', flexWrap: 'wrap', alignItems: 'center' }}>
              <span>📍 <span style={{ color: '#cbd5e1' }}>{mc.currentLocation}</span></span>
              <span>Allergies: <span style={{ color: '#fca5a5' }}>NKDA</span></span>
              <span>Code: <span style={{ color: '#cbd5e1' }}>Full Code</span></span>
              {mc.specialty_tags?.length ? <span>Tags: <span style={{ color: '#c7d2fe' }}>{mc.specialty_tags.join(' · ')}</span></span> : null}
              {mc.currentCondition && <span style={{ fontStyle: 'italic', color: '#64748b' }}>{mc.currentCondition}</span>}
            </div>
          </div>

          {/* ── Vitals strip ── */}
          <div style={{ background: '#f8fafc', borderBottom: `1px solid ${T.border}`, padding: '8px 16px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: T.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginRight: 4 }}>Vitals</span>
            {abn && <>
              <VitalChip label="HR" value={`${mc.vitals.heartRate}`} unit="bpm" crit={abn.hrCrit} warn={abn.hr} />
              <VitalChip label="BP" value={mc.vitals.bloodPressure} unit="mmHg" crit={abn.bpCrit} warn={abn.bp} />
              <VitalChip label="RR" value={`${mc.vitals.respiratoryRate}`} unit="/min" crit={abn.rrCrit} warn={abn.rr} />
              <VitalChip label="SpO₂" value={`${mc.vitals.oxygenSaturation}`} unit="%" crit={abn.spo2Crit} warn={abn.spo2} />
              <VitalChip label="Temp" value={`${mc.vitals.temperature}`} unit="°C" crit={abn.tempCrit} warn={abn.temp} />
              {mc.vitals.weightKg && <VitalChip label="Wt" value={`${mc.vitals.weightKg}`} unit="kg" />}
            </>}
            {mc.activeAlarms?.map((alarm, i) => (
              <span key={i} style={{ background: T.redLt, color: T.red, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, border: `1px solid ${T.redBd}` }}>⚡ {alarm}</span>
            ))}
          </div>

          {/* ── Critical banner ── */}
          {newCrits.length > 0 && (
            <div style={{ background: '#fef2f2', borderBottom: `2px solid ${T.red}`, padding: '8px 16px', display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
              <span style={{ background: T.red, color: '#fff', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>CRITICAL</span>
              {newCrits.slice(0, 3).map(l => (
                <span key={l.name} style={{ fontSize: 12, color: T.red }}>
                  <strong>{l.name}</strong>: {l.value} {l.unit} <span style={{ color: T.muted }}>(ref {l.normalRange})</span>
                </span>
              ))}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button onClick={() => { setTab('results'); setCritDismissed(p => new Set([...p, ...newCrits.map(l => l.name)])); }} style={btn('sm', 'danger')}>View Results</button>
                <button onClick={() => setCritDismissed(p => new Set([...p, ...newCrits.map(l => l.name)]))} style={btn('sm', 'ghost')}>Dismiss</button>
              </div>
            </div>
          )}

          {/* ── Tab bar ── */}
          <nav style={{ background: T.card, borderBottom: `1px solid ${T.border}`, padding: '0 16px', display: 'flex', gap: 2, flexShrink: 0, overflowX: 'auto' }}>
            {(['chart', 'orders', 'results', 'mar', 'consult', 'assessment'] as Tab[]).map(t => {
              const active = tab === t;
              return (
                <button key={t} onClick={() => setTab(t)} style={{ padding: '12px 16px', fontSize: 13, fontWeight: active ? 600 : 400, color: active ? T.indigo : T.muted, background: 'none', border: 'none', cursor: 'pointer', borderBottom: `2px solid ${active ? T.indigo : 'transparent'}`, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6, fontFamily: T.sans, transition: 'color 0.15s' }}>
                  {t === 'chart'  && 'Chart Review'}
                  {t === 'orders' && <>Orders {(mc.clinicalActions || []).filter(a => a.type !== 'time-advance').length > 0 && <TabBadge n={(mc.clinicalActions || []).filter(a => a.type !== 'time-advance').length} />}</>}
                  {t === 'results' && <>Results {resultCount > 0 && <TabBadge n={resultCount} color={critCount > 0 ? T.red : T.emerald} />}{hasNewResult && tab !== 'results' && <span style={{ width: 6, height: 6, borderRadius: 3, background: T.red, display: 'inline-block' }} />}</>}
                  {t === 'mar' && <>MAR {activeMeds.length > 0 && <TabBadge n={activeMeds.length} color={T.emerald} />}</>}
                  {t === 'consult' && <>Consult {isConsulting && <span style={{ width: 6, height: 6, borderRadius: 3, background: T.amber, display: 'inline-block' }} />}</>}
                  {t === 'assessment' && 'Assessment'}
                </button>
              );
            })}
          </nav>

          {/* ── Content ── */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

            {/* CHART */}
            {tab === 'chart' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 1280 }}>

                {/* HPI */}
                <Card fullWidth title="History of Present Illness">
                  <div style={{ padding: '12px 16px', lineHeight: 1.75, color: T.textSm }}>{mc.historyOfPresentIllness}</div>
                  <Divider />
                  <div style={{ padding: '8px 16px 12px', fontSize: 13 }}>
                    <span style={{ fontWeight: 600, color: T.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Chief Complaint </span>
                    <span style={{ color: T.textSm }}>{mc.chiefComplaint}</span>
                  </div>
                  {mc.initialAppearance && (
                    <>
                      <Divider />
                      <div style={{ padding: '8px 16px 12px', fontSize: 13, color: T.textSm, fontStyle: 'italic', background: '#fafbff' }}>
                        <span style={{ fontWeight: 600, fontStyle: 'normal', color: T.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Appearance </span>
                        {mc.initialAppearance}
                      </div>
                    </>
                  )}
                </Card>

                {/* PMH + recommended consultations */}
                <Card title="Past Medical History & Consultations">
                  {(mc.pastMedicalHistory || []).map((h, i) => (
                    <div key={i} style={{ padding: '8px 16px', borderBottom: `1px solid ${T.border}`, fontSize: 13, color: T.textSm, background: i % 2 ? '#fafbff' : '#fff' }}>
                      {h}
                    </div>
                  ))}
                  {mc.requiredConsultations?.length ? (
                    <>
                      <SectionHead color={T.emerald}>Recommended Consultations</SectionHead>
                      {mc.requiredConsultations.map((c, i) => (
                        <div key={i} style={{ padding: '8px 16px', borderBottom: `1px solid ${T.border}`, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: i % 2 ? T.emeraldLt : '#fff' }}>
                          <span>{c}</span>
                          <button onClick={() => { handleConsult(); setTab('consult'); }} style={btn('sm', 'success')}>Consult →</button>
                        </div>
                      ))}
                    </>
                  ) : null}
                </Card>

                {/* Management conflicts */}
                {mc.managementConflicts?.length ? (
                  <Card title="⚠ Active Management Conflicts" titleColor={T.amber} fullWidth>
                    {mc.managementConflicts.map((c, i) => (
                      <div key={i} style={{ padding: '8px 16px', borderBottom: `1px solid ${T.amberBd}`, fontSize: 13, color: T.amber, background: i % 2 ? T.amberLt : '#fff' }}>
                        {c}
                      </div>
                    ))}
                  </Card>
                ) : null}

                {/* Physical exam */}
                <Card fullWidth title="Physical Examination"
                  action={mc.physicalExam && Object.values(mc.physicalExam).some(v => v === '[[LOCKED]]')
                    ? <button onClick={examineAll} disabled={isBusy} style={btn('sm', 'ghost')}>Examine All</button>
                    : undefined}
                >
                  {mc.physicalExam && (Object.entries(mc.physicalExam) as [string, string][]).map(([sys, val], i) => {
                    const locked = val === '[[LOCKED]]';
                    const open = examOpen[sys];
                    return (
                      <div key={sys} style={{ display: 'flex', borderBottom: `1px solid ${T.border}`, background: i % 2 ? '#fafbff' : '#fff', minHeight: 38 }}>
                        <div style={{ width: 140, flexShrink: 0, padding: '8px 16px', fontSize: 11, fontWeight: 600, color: T.muted, letterSpacing: 0.5, textTransform: 'uppercase', borderRight: `1px solid ${T.border}` }}>
                          {sys}
                        </div>
                        <div style={{ flex: 1, padding: '8px 16px', fontSize: 13, color: T.textSm, lineHeight: 1.6 }}>
                          {locked ? (
                            <button onClick={() => {
                              setMedicalCase(prev => prev ? { ...prev, clinicalActions: [...(prev.clinicalActions || []), { id: `exam-${Date.now()}`, timestamp: prev.simulationTime, type: 'exam' as const, description: `Performed physical exam: ${sys}` }] } : prev);
                              setExamOpen(p => ({ ...p, [sys]: true }));
                            }} style={btn('sm', 'ghost')}>Perform Exam</button>
                          ) : (
                            <span style={{ cursor: val.length > 120 ? 'pointer' : undefined }} onClick={() => val.length > 120 && setExamOpen(p => ({ ...p, [sys]: !p[sys] }))}>
                              {open || val.length <= 120 ? val : val.slice(0, 120) + '…'}
                              {val.length > 120 && <span style={{ color: T.indigo, fontSize: 11, marginLeft: 6 }}>{open ? 'less' : 'more'}</span>}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </Card>
              </div>
            )}

            {/* ORDERS */}
            {tab === 'orders' && (
              <div style={{ maxWidth: 1000 }}>
                <Card title="Order History">
                  {(mc.clinicalActions || []).filter(a => a.type !== 'time-advance').length === 0 ? (
                    <EmptyState>No orders placed yet.</EmptyState>
                  ) : (
                    <table style={tbl}>
                      <thead>
                        <tr>
                          <Th style={{ width: 80 }}>Time</Th>
                          <Th style={{ width: 100 }}>Type</Th>
                          <Th>Order / Action</Th>
                          <Th>Result / Impact</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...(mc.clinicalActions || [])].filter(a => a.type !== 'time-advance').reverse().map((a, i) => {
                          const badge = actionBadge[a.type] || { bg: T.bg, color: T.muted, label: a.type };
                          return (
                            <tr key={a.id} style={{ background: i % 2 ? '#fafbff' : '#fff' }}>
                              <Td style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>T+{a.timestamp}m</Td>
                              <Td>
                                <span style={{ background: badge.bg, color: badge.color, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{badge.label}</span>
                              </Td>
                              <Td>{a.description}</Td>
                              <Td style={{ color: T.muted, fontStyle: 'italic', fontSize: 12 }}>{a.impact || '—'}</Td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </Card>
              </div>
            )}

            {/* RESULTS */}
            {tab === 'results' && (
              <div style={{ maxWidth: 1200, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Card title={<>Lab Results {critCount > 0 && <span style={{ background: T.red, color: '#fff', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, marginLeft: 8 }}>⚠ {critCount} critical</span>}</>}>
                  {availLabs.length === 0 && pendLabs.length === 0 ? (
                    <EmptyState>No labs ordered yet.</EmptyState>
                  ) : (
                    <table style={tbl}>
                      <thead>
                        <tr>
                          <Th style={{ width: '28%' }}>Test</Th>
                          <Th>Result</Th>
                          <Th>Units</Th>
                          <Th>Ref Range</Th>
                          <Th style={{ textAlign: 'center', width: 60 }}>Flag</Th>
                          <Th style={{ width: 90 }}>Available</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {availLabs.map((l, i) => {
                          const f = labFlag(l);
                          const isCrit = l.status === 'critical';
                          const isAbn  = l.status === 'abnormal';
                          return (
                            <tr key={i} style={{ background: isCrit ? T.redLt : isAbn ? T.amberLt : i % 2 ? '#fafbff' : '#fff' }}>
                              <Td style={{ fontWeight: 500 }}>{l.name}</Td>
                              <Td style={{ fontFamily: T.mono, fontWeight: (isCrit || isAbn) ? 700 : 400, color: isCrit ? T.red : isAbn ? T.amber : T.text, fontSize: 14 }}>{l.value}</Td>
                              <Td style={{ fontFamily: T.mono, color: T.muted, fontSize: 12 }}>{l.unit}</Td>
                              <Td style={{ fontFamily: T.mono, color: T.muted, fontSize: 12 }}>{l.normalRange}</Td>
                              <Td style={{ textAlign: 'center' }}>
                                {f.code
                                  ? <span style={{ background: f.bg, color: f.color, padding: '2px 7px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{f.code}</span>
                                  : <span style={{ color: T.emerald, fontSize: 13 }}>—</span>}
                              </Td>
                              <Td style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>T+{l.availableAt}m</Td>
                            </tr>
                          );
                        })}
                        {pendLabs.map((l, i) => (
                          <tr key={`p${i}`} style={{ background: '#fafbff', color: T.muted }}>
                            <Td>{l.name}</Td>
                            <Td colSpan={4} style={{ fontStyle: 'italic', fontSize: 12 }}>
                              Pending — ETA T+{l.availableAt}m
                              <span style={{ marginLeft: 6, background: T.bg, padding: '1px 6px', borderRadius: 10, fontSize: 11 }}>{Math.max(0, (l.availableAt ?? 0) - simTime)} min remaining</span>
                            </Td>
                            <Td style={{ fontFamily: T.mono, fontSize: 11 }}>T+{l.availableAt}m</Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Card>

                <Card title="Imaging & Diagnostics">
                  {availImgs.length === 0 && pendImgs.length === 0 ? (
                    <EmptyState>No imaging ordered yet.</EmptyState>
                  ) : (
                    <>
                      {availImgs.map((img, i) => (
                        <div key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                          <div onClick={() => setImgOpen(p => ({ ...p, [img.type]: !p[img.type] }))}
                            style={{ padding: '10px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: i % 2 ? '#fafbff' : '#fff' }}>
                            <span style={{ fontWeight: 600, fontSize: 13 }}>{img.type}</span>
                            <span style={{ color: T.muted, fontSize: 12 }}>T+{img.availableAt}m · {imgOpen[img.type] ? '▲' : '▼'}</span>
                          </div>
                          {imgOpen[img.type] && (
                            <div style={{ padding: '12px 24px 16px', background: '#fafbff', borderTop: `1px solid ${T.border}` }}>
                              {img.findings && <p style={{ marginBottom: 8, lineHeight: 1.7, fontSize: 13, color: T.textSm }}><span style={{ fontWeight: 600, fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Findings</span><br />{img.findings}</p>}
                              {img.impression && <p style={{ lineHeight: 1.7, fontSize: 13, fontWeight: 500 }}><span style={{ fontWeight: 600, fontSize: 11, color: T.red, textTransform: 'uppercase', letterSpacing: 0.5 }}>Impression</span><br />{img.impression}</p>}
                            </div>
                          )}
                        </div>
                      ))}
                      {pendImgs.map((img, i) => (
                        <div key={`pi${i}`} style={{ padding: '10px 16px', color: T.muted, fontSize: 13, borderBottom: `1px solid ${T.border}`, fontStyle: 'italic' }}>
                          {img.type} — Pending ETA T+{img.availableAt}m ({Math.max(0, (img.availableAt ?? 0) - simTime)} min)
                        </div>
                      ))}
                    </>
                  )}
                </Card>
              </div>
            )}

            {/* MAR */}
            {tab === 'mar' && (
              <div style={{ maxWidth: 1000, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Card title={`Medication Administration Record — Active (${activeMeds.length})`}>
                  {activeMeds.length === 0 ? (
                    <EmptyState>No active medications.</EmptyState>
                  ) : (
                    <table style={tbl}>
                      <thead>
                        <tr>
                          <Th style={{ width: '35%' }}>Medication</Th>
                          <Th>Dose</Th>
                          <Th>Route</Th>
                          <Th>Started</Th>
                          <Th style={{ width: 110 }}>Action</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeMeds.map((m, i) => (
                          <tr key={m.id} style={{ background: i % 2 ? '#fafbff' : '#fff' }}>
                            <Td style={{ fontWeight: 600 }}>{m.name}</Td>
                            <Td>{m.dose}</Td>
                            <Td>{m.route}</Td>
                            <Td style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>T+{m.timestamp}m</Td>
                            <Td><button onClick={() => handleDiscontinueMedication(m.id, m.name)} style={btn('sm', 'danger')}>Discontinue</button></Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Card>
                {discMeds.length > 0 && (
                  <Card title="Discontinued Medications">
                    <table style={tbl}>
                      <tbody>
                        {discMeds.map((m, i) => (
                          <tr key={m.id} style={{ background: i % 2 ? '#fafbff' : '#fff', color: T.muted }}>
                            <Td><s>{m.name}</s></Td>
                            <Td><s>{m.dose} {m.route}</s></Td>
                            <Td style={{ fontFamily: T.mono, fontSize: 11 }}>T+{m.timestamp}m → T+{m.discontinuedAt}m</Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Card>
                )}
              </div>
            )}

            {/* CONSULT */}
            {tab === 'consult' && (
              <div style={{ maxWidth: 820, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Card title="AI Consultant" action={
                  <button onClick={() => handleConsult()} disabled={isBusy || isConsulting} style={btn('sm', isConsulting ? 'ghost' : 'primary')}>
                    {isConsulting ? 'Consulting…' : 'Request Consult'}
                  </button>
                }>
                  {isConsulting ? (
                    <div style={{ padding: 32, textAlign: 'center', color: T.muted }}>
                      <Spinner />
                      <div style={{ marginTop: 10 }}>Awaiting consultant response…</div>
                    </div>
                  ) : consultantAdvice ? (
                    <div style={{ padding: 16 }}>
                      <blockquote style={{ background: T.indigoLt, border: `1px solid #c7d2fe`, borderRadius: 8, padding: '12px 16px', margin: '0 0 16px', fontStyle: 'italic', fontSize: 14, color: T.textSm, lineHeight: 1.75 }}>
                        "{consultantAdvice.advice}"
                      </blockquote>
                      {consultantAdvice.reasoning && (
                        <p style={{ fontSize: 13, color: T.textSm, lineHeight: 1.75, marginBottom: 16 }}>{consultantAdvice.reasoning}</p>
                      )}
                      <div style={{ fontWeight: 600, fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Recommended Actions</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {consultantAdvice.recommendedActions.map((a, i) => (
                          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                            <span style={{ background: T.indigo, color: '#fff', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                            <span style={{ fontSize: 13, color: T.textSm, lineHeight: 1.6 }}>{a}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '40px 24px', textAlign: 'center' }}>
                      <div style={{ fontSize: 32, marginBottom: 10 }}>💬</div>
                      <div style={{ color: T.muted, marginBottom: 16 }}>No consultation requested yet.</div>
                      <button onClick={() => handleConsult()} disabled={isBusy} style={btn('md')}>Request AI Consult</button>
                    </div>
                  )}
                </Card>
                {mc.requiredConsultations?.length ? (
                  <Card title="Subspecialty Consultations Required">
                    {mc.requiredConsultations.map((c, i) => (
                      <div key={i} style={{ padding: '10px 16px', borderBottom: `1px solid ${T.border}`, fontSize: 13, background: i % 2 ? T.emeraldLt : '#fff' }}>{c}</div>
                    ))}
                  </Card>
                ) : null}
              </div>
            )}

            {/* ASSESSMENT */}
            {tab === 'assessment' && (
              <div style={{ maxWidth: 980, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Card title="Case Assessment & Scoring">
                  <div style={{ padding: 16 }}>
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
                      onNewCase={() => loadNewCase()}
                    />
                  </div>
                </Card>
                {user && (
                  <Card title="Performance History">
                    <div style={{ padding: 16 }}><ArchiveView user={user} /></div>
                  </Card>
                )}
              </div>
            )}
          </div>

          {/* ── Quick-order chips ── */}
          {(quickLabs.length > 0 || quickImgs.length > 0) && (
            <div style={{ background: T.card, borderTop: `1px solid ${T.border}`, padding: '6px 16px', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: T.muted, letterSpacing: 0.5, textTransform: 'uppercase', marginRight: 2 }}>Quick order</span>
              {quickLabs.map(t => (
                <button key={t.name} onClick={() => handleOrderTest('lab', t.name)} disabled={isBusy}
                  style={{ fontSize: 11, padding: '3px 10px', cursor: 'pointer', color: T.blue, background: T.blueLt, border: `1px solid #bfdbfe`, borderRadius: 20, whiteSpace: 'nowrap', fontFamily: T.sans }}>
                  + {t.name}
                </button>
              ))}
              {quickImgs.map(t => (
                <button key={t.name} onClick={() => handleOrderTest('imaging', t.name)} disabled={isBusy}
                  style={{ fontSize: 11, padding: '3px 10px', cursor: 'pointer', color: T.purple, background: T.purpleLt, border: `1px solid #ddd6fe`, borderRadius: 20, whiteSpace: 'nowrap', fontFamily: T.sans }}>
                  + {t.name}
                </button>
              ))}
            </div>
          )}

          {/* ── CPOE bar ── */}
          <div style={{ background: T.card, borderTop: `2px solid ${T.indigo}`, padding: '8px 16px', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: T.indigo, letterSpacing: 0.8, textTransform: 'uppercase' }}>CPOE</span>
              <div style={{ flex: 1, minWidth: 260, position: 'relative' }}>
                <input
                  ref={inputRef}
                  type="text"
                  value={orderInput}
                  onChange={e => { setOrderInput(e.target.value); search(e.target.value); }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') submitOrder();
                    if (e.key === 'Escape') { setSuggestions([]); setAcOpen(false); }
                  }}
                  onBlur={() => setTimeout(() => setAcOpen(false), 150)}
                  onFocus={() => orderInput && search(orderInput)}
                  placeholder={isBusy ? 'Processing…' : 'Search or enter order (labs, imaging, medications, procedures…)'}
                  disabled={isBusy}
                  style={{ width: '100%', padding: '7px 12px', fontSize: 13, fontFamily: T.sans, border: `1px solid ${T.borderMd}`, borderRadius: 6, background: isBusy ? T.bg : '#fff', boxSizing: 'border-box', outline: 'none' }}
                />
                {acOpen && suggestions.length > 0 && (
                  <div style={{ position: 'absolute', bottom: 'calc(100% + 4px)', left: 0, right: 0, background: '#fff', border: `1px solid ${T.border}`, borderRadius: 8, boxShadow: '0 -8px 24px rgba(0,0,0,0.12)', zIndex: 100, maxHeight: 260, overflowY: 'auto' }}>
                    {suggestions.map(s => (
                      <button key={s.name} onMouseDown={() => placeTest(s)}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '8px 12px', background: 'none', border: 'none', borderBottom: `1px solid ${T.border}`, cursor: 'pointer', textAlign: 'left', fontFamily: T.sans, fontSize: 13, color: T.text }}>
                        <span>{s.name}</span>
                        <span style={{ fontSize: 11, color: s._kind === 'lab' ? T.blue : T.purple, background: s._kind === 'lab' ? T.blueLt : T.purpleLt, padding: '2px 8px', borderRadius: 20, marginLeft: 10, whiteSpace: 'nowrap' }}>
                          {s._kind} · STAT {s.stat}m
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <select value={urgency} onChange={e => setUrgency(e.target.value as 'STAT' | 'Routine')}
                style={{ padding: '7px 10px', fontSize: 13, border: `1px solid ${T.borderMd}`, borderRadius: 6, background: '#fff', fontFamily: T.sans }}>
                <option>STAT</option>
                <option>Routine</option>
              </select>
              <button onClick={submitOrder} disabled={isBusy || !orderInput.trim()} style={btn('md')}>
                Place Order
              </button>
              <div style={{ width: 1, background: T.border, height: 24, margin: '0 4px' }} />
              <span style={{ fontSize: 12, color: T.muted }}>Advance:</span>
              <select value={advanceMin} onChange={e => setAdvanceMin(Number(e.target.value))}
                style={{ padding: '7px 8px', fontSize: 12, border: `1px solid ${T.borderMd}`, borderRadius: 6, background: '#fff', fontFamily: T.sans }}>
                {[5, 10, 15, 20, 30, 45, 60].map(n => <option key={n} value={n}>{n} min</option>)}
              </select>
              <button onClick={() => handleAdvanceTime(advanceMin)} disabled={isBusy} style={btn('md', 'ghost')}>↻ Advance</button>
              <div style={{ width: 1, background: T.border, height: 24, margin: '0 4px' }} />
              <button onClick={() => setTab('assessment')} style={btn('md', 'danger')}>End Case</button>
            </div>
          </div>
        </>
      )}

      {/* DiagnosisPad */}
      {mc && (
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

      {/* Stage Commit Gate */}
      {mc && pendingStage && (
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
            if (snapId && pendingStage) { reasoning.goToStage(pendingStage); setPendingStage(null); }
            return snapId;
          }}
          onCancel={() => setPendingStage(null)}
        />
      )}
    </div>
  );
}

// ─── Small shared components ───────────────────────────────────────────────────
function Spinner() {
  return (
    <div style={{ width: 24, height: 24, border: `3px solid ${T.border}`, borderTop: `3px solid ${T.indigo}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
  );
}

function VitalChip({ label, value, unit, crit, warn }: { label: string; value: string; unit: string; crit?: boolean; warn?: boolean }) {
  const bg = crit ? T.redLt : warn ? T.amberLt : '#fff';
  const bd = crit ? T.redBd : warn ? T.amberBd : T.border;
  const vc = crit ? T.red : warn ? T.amber : T.textSm;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 2, padding: '3px 10px', borderRadius: 20, background: bg, border: `1px solid ${bd}` }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: T.muted }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: crit || warn ? 700 : 500, color: vc, fontFamily: T.mono, marginLeft: 3 }}>{value}</span>
      <span style={{ fontSize: 10, color: T.muted }}>{unit}</span>
      {crit && <span style={{ fontSize: 10, color: T.red, marginLeft: 2 }}>▲▲</span>}
      {!crit && warn && <span style={{ fontSize: 10, color: T.amber, marginLeft: 2 }}>▲</span>}
    </div>
  );
}

function TabBadge({ n, color = T.indigo }: { n: number; color?: string }) {
  return <span style={{ background: color, color: '#fff', borderRadius: 20, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>{n}</span>;
}

function Pill({ children, color, bg, style }: { children: ReactNode; color: string; bg: string; style?: React.CSSProperties }) {
  return <span style={{ background: bg, color, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, ...style }}>{children}</span>;
}

function Card({ title, children, fullWidth, action, titleColor }: { title: ReactNode; children: ReactNode; fullWidth?: boolean; action?: ReactNode; titleColor?: string }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', ...(fullWidth ? { gridColumn: '1 / -1' } : {}) }}>
      <div style={{ padding: '10px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fafbff' }}>
        <span style={{ fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, color: titleColor || T.textSm }}>{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

function SubHead({ label, color = E.textSm, bg = E.panelHead }: { label: string; color?: string; bg?: string }) {
  return (
    <div style={{ background: bg, padding: '3px 10px', fontSize: 10, fontWeight: 600, color, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: `1px solid ${E.border}`, borderTop: `1px solid ${E.border}` }}>
      {label}
function SectionHead({ children, color = T.muted }: { children: ReactNode; color?: string }) {
  return (
    <div style={{ padding: '6px 16px', background: '#f8fafc', borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`, fontWeight: 600, fontSize: 11, color, textTransform: 'uppercase', letterSpacing: 0.5 }}>
      {children}
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
function Divider() { return <div style={{ height: 1, background: T.border }} />; }

function EmptyState({ children }: { children: ReactNode }) {
  return <div style={{ padding: '24px 16px', color: T.muted, fontSize: 13, textAlign: 'center' }}>{children}</div>;
}

function HeaderBtn({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ background: 'none', border: '1px solid #334155', color: '#94a3b8', padding: '4px 10px', fontSize: 12, cursor: 'pointer', borderRadius: 6, fontFamily: T.sans }}>
      {children}
    </button>
  );
}

// ─── Table helpers ─────────────────────────────────────────────────────────────
const tbl: React.CSSProperties = { width: '100%', borderCollapse: 'collapse' };

function Th({ children, style }: { children?: ReactNode; style?: React.CSSProperties }) {
  return <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: `1px solid ${T.border}`, background: '#fafbff', ...style }}>{children}</th>;
}
function Td({ children, style, colSpan }: { children?: ReactNode; style?: React.CSSProperties; colSpan?: number }) {
  return <td colSpan={colSpan} style={{ padding: '8px 16px', fontSize: 13, borderBottom: `1px solid ${T.border}`, verticalAlign: 'top', ...style }}>{children}</td>;
}

// ─── Button factory ────────────────────────────────────────────────────────────
function btn(size: 'sm' | 'md' | 'lg', variant: 'primary' | 'ghost' | 'danger' | 'success' = 'primary'): React.CSSProperties {
  const pad = size === 'sm' ? '3px 10px' : size === 'lg' ? '10px 24px' : '6px 16px';
  const fs  = size === 'sm' ? 11 : size === 'lg' ? 14 : 13;
  const base: React.CSSProperties = { padding: pad, fontSize: fs, fontFamily: T.sans, borderRadius: 6, cursor: 'pointer', fontWeight: 500, border: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 };
  if (variant === 'ghost') return { ...base, background: T.bg, color: T.textSm, border: `1px solid ${T.borderMd}` };
  if (variant === 'danger') return { ...base, background: T.red, color: '#fff' };
  if (variant === 'success') return { ...base, background: T.emerald, color: '#fff' };
  return { ...base, background: T.indigo, color: '#fff' };
}
